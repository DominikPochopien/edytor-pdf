import type { PageInfo } from '../../domain/document';
import type {
  DisplayFrame,
  EditModel,
  EditObject,
  HexColor,
  ObjectId,
  ShapeObject,
} from '../../domain/objects';
import {
  copiesForPaste,
  displayToFrame,
  findObject,
  frameToDisplay,
  moveFrameOnScreen,
} from '../../domain/objects';
import type { Command } from '../commands';
import {
  AddObjectsCommand,
  RemoveObjectsCommand,
  ReorderObjectCommand,
  UpdateObjectsCommand,
} from '../commands';

/** Style of new shapes until the user changes it. */
export const DEFAULT_SHAPE_STYLE = {
  stroke: '#dc2626',
  fill: null,
  strokeWidth: 2,
  opacity: 1,
} as const satisfies Pick<ShapeObject, 'stroke' | 'fill' | 'strokeWidth' | 'opacity'>;

/** Size of a shape created by a single click (no drag), in points. */
export const DEFAULT_SHAPE_SIZE = { width: 120, height: 80 } as const;
/** Smaller drags than this count as a click. */
export const MIN_DRAWN_SIZE = 4;
/** Consecutive edits of the same kind within this time become one Undo step. */
export const MERGE_WINDOW_MS = 1000;
/** Arrow keys move objects by this many points (with Shift: the larger step). */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;

export type IdGenerator = () => ObjectId;
export type PageLookup = (pageIndex: number) => PageInfo | undefined;

export function createRectangle(
  page: PageInfo,
  display: DisplayFrame,
  newId: IdGenerator,
): Command {
  const small = display.width < MIN_DRAWN_SIZE || display.height < MIN_DRAWN_SIZE;
  const frameOnScreen = small ? { ...display, ...DEFAULT_SHAPE_SIZE } : display;
  const shape: ShapeObject = {
    id: newId(),
    kind: 'shape',
    shape: 'rectangle',
    pageIndex: page.index,
    frame: displayToFrame(frameOnScreen, page),
    ...DEFAULT_SHAPE_STYLE,
  };
  return new AddObjectsCommand([shape]);
}

export function transformObject(
  model: EditModel,
  id: ObjectId,
  display: DisplayFrame,
  pages: PageLookup,
  kind: 'move' | 'transform',
): Command | null {
  const object = findObject(model, id);
  const page = object === undefined ? undefined : pages(object.pageIndex);
  if (object === undefined || page === undefined) {
    return null;
  }
  return new UpdateObjectsCommand(
    [object],
    [{ ...object, frame: displayToFrame(display, page) }],
    kind,
  );
}

function selected(model: EditModel, ids: readonly ObjectId[]): EditObject[] {
  const wanted = new Set(ids);
  return model.objects.filter((o) => wanted.has(o.id));
}

export function nudgeObjects(
  model: EditModel,
  ids: readonly ObjectId[],
  pages: PageLookup,
  dx: number,
  dy: number,
  now: number,
): Command | null {
  const before = selected(model, ids);
  const after = before.map((object) => {
    const page = pages(object.pageIndex);
    return page === undefined
      ? object
      : { ...object, frame: moveFrameOnScreen(object.frame, page, dx, dy) };
  });
  if (before.length === 0) {
    return null;
  }
  return new UpdateObjectsCommand(before, after, 'move', {
    key: `nudge:${ids.join(',')}`,
    at: now,
    windowMs: MERGE_WINDOW_MS,
  });
}

export function removeSelection(model: EditModel, ids: readonly ObjectId[]): Command | null {
  const command = new RemoveObjectsCommand(model, ids);
  return command.isEmpty ? null : command;
}

export interface CopyResult {
  readonly command: Command;
  readonly ids: readonly ObjectId[];
}

/** Copies the objects onto `target` page (duplicate: same page; paste: the page the user is on). */
export function copyObjects(
  objects: readonly EditObject[],
  target: PageInfo,
  newId: IdGenerator,
  label: 'paste' | 'duplicate',
): CopyResult | null {
  if (objects.length === 0) {
    return null;
  }
  const copies = copiesForPaste(objects, target, newId);
  return { command: new AddObjectsCommand(copies, label), ids: copies.map((c) => c.id) };
}

export function duplicateSelection(
  model: EditModel,
  ids: readonly ObjectId[],
  pages: PageLookup,
  newId: IdGenerator,
): CopyResult | null {
  const objects = selected(model, ids);
  const page = objects[0] === undefined ? undefined : pages(objects[0].pageIndex);
  return page === undefined ? null : copyObjects(objects, page, newId, 'duplicate');
}

export function selectedObjects(model: EditModel, ids: readonly ObjectId[]): EditObject[] {
  return selected(model, ids);
}

/** Moves an object above all others on its page ('front') or below them ('back'). */
export function reorderObject(
  model: EditModel,
  id: ObjectId,
  direction: 'front' | 'back',
): Command | null {
  const from = model.objects.findIndex((o) => o.id === id);
  const object = model.objects[from];
  if (object === undefined) {
    return null;
  }
  const pageIndices = model.objects
    .map((o, index) => ({ o, index }))
    .filter(({ o }) => o.pageIndex === object.pageIndex)
    .map(({ index }) => index);
  const to = direction === 'front' ? Math.max(...pageIndices) : Math.min(...pageIndices);
  return to === from ? null : new ReorderObjectCommand(id, from, to);
}

export interface StylePatch {
  readonly stroke?: HexColor | null;
  readonly fill?: HexColor | null;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export function restyleObject(
  model: EditModel,
  id: ObjectId,
  patch: StylePatch,
  now: number,
): Command | null {
  const object = findObject(model, id);
  if (object === undefined) {
    return null;
  }
  const field = Object.keys(patch).join(',');
  return new UpdateObjectsCommand([object], [{ ...object, ...patch }], 'style', {
    key: `style:${id}:${field}`,
    at: now,
    windowMs: MERGE_WINDOW_MS,
  });
}

/** Sets position (top-left of the unrotated box on screen), size or rotation from the properties panel. */
export function reshapeObject(
  model: EditModel,
  id: ObjectId,
  pages: PageLookup,
  change: (display: DisplayFrame) => DisplayFrame,
  now: number,
): Command | null {
  const object = findObject(model, id);
  const page = object === undefined ? undefined : pages(object.pageIndex);
  if (object === undefined || page === undefined) {
    return null;
  }
  const updated = {
    ...object,
    frame: displayToFrame(change(frameToDisplay(object.frame, page)), page),
  };
  return new UpdateObjectsCommand([object], [updated], 'transform', {
    key: `reshape:${id}`,
    at: now,
    windowMs: MERGE_WINDOW_MS,
  });
}
