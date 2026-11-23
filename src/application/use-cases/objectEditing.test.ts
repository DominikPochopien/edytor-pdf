import { describe, expect, it } from 'vitest';
import type { PageInfo } from '../../domain/document';
import type { ShapeObject } from '../../domain/objects';
import { frameToDisplay } from '../../domain/objects';
import { EditorSession } from '../commands';
import {
  createRectangle,
  DEFAULT_SHAPE_SIZE,
  DEFAULT_SHAPE_STYLE,
  duplicateSelection,
  nudgeObjects,
  removeSelection,
  reorderObject,
  reshapeObject,
  restyleObject,
  selectedObjects,
  transformObject,
} from './objectEditing';

const pages: PageInfo[] = [
  { index: 0, rotation: 0, cropBox: { x: 0, y: 0, width: 595, height: 842 } },
  { index: 1, rotation: 90, cropBox: { x: 0, y: 0, width: 595, height: 842 } },
];
const lookup = (i: number): PageInfo | undefined => pages[i];

function setup() {
  const session = new EditorSession();
  let n = 0;
  const newId = (): string => `id-${++n}`;
  return { session, newId };
}

function onlyShape(session: EditorSession, index = 0): ShapeObject {
  const object = session.snapshot.model.objects[index];
  if (object === undefined) {
    throw new Error('no object');
  }
  return object;
}

describe('object editing use cases', () => {
  it('creates a rectangle where it was drawn, with the default style', () => {
    const { session, newId } = setup();
    session.execute(
      createRectangle(
        pages[1]!,
        { center: { x: 200, y: 100 }, width: 50, height: 30, angle: 0 },
        newId,
      ),
    );
    const shape = onlyShape(session);
    expect(shape.stroke).toBe(DEFAULT_SHAPE_STYLE.stroke);
    const display = frameToDisplay(shape.frame, pages[1]!);
    expect(display.center.x).toBeCloseTo(200);
    expect(display.center.y).toBeCloseTo(100);
    expect(display.angle).toBeCloseTo(0);
  });

  it('a click without dragging creates a default-size rectangle', () => {
    const { session, newId } = setup();
    session.execute(
      createRectangle(
        pages[0]!,
        { center: { x: 50, y: 50 }, width: 1, height: 0, angle: 0 },
        newId,
      ),
    );
    expect(onlyShape(session).frame.width).toBe(DEFAULT_SHAPE_SIZE.width);
  });

  it('moves, nudges, duplicates, restyles, reorders and removes', () => {
    const { session, newId } = setup();
    const at = (x: number) => ({ center: { x, y: 100 }, width: 20, height: 20, angle: 0 });
    session.execute(createRectangle(pages[0]!, at(100), newId));
    session.execute(createRectangle(pages[0]!, at(300), newId));
    const [a, b] = session.snapshot.model.objects.map((o) => o.id) as [string, string];

    session.execute(
      transformObject(session.snapshot.model, a, { ...at(150), angle: 30 }, lookup, 'transform')!,
    );
    expect(frameToDisplay(onlyShape(session).frame, pages[0]!).angle).toBeCloseTo(30);

    session.execute(nudgeObjects(session.snapshot.model, [a], lookup, 10, 0, 0)!);
    session.execute(nudgeObjects(session.snapshot.model, [a], lookup, 10, 0, 100)!);
    expect(frameToDisplay(onlyShape(session).frame, pages[0]!).center.x).toBeCloseTo(170);
    session.undo();
    expect(frameToDisplay(onlyShape(session).frame, pages[0]!).center.x).toBeCloseTo(150);
    session.redo();

    const copy = duplicateSelection(session.snapshot.model, [a], lookup, newId)!;
    session.execute(copy.command);
    expect(session.snapshot.model.objects).toHaveLength(3);
    expect(selectedObjects(session.snapshot.model, copy.ids)[0]?.pageIndex).toBe(0);

    session.execute(restyleObject(session.snapshot.model, b, { fill: '#00ff00' }, 0)!);
    expect(onlyShape(session, 1).fill).toBe('#00ff00');

    session.execute(reorderObject(session.snapshot.model, a, 'front')!);
    expect(session.snapshot.model.objects.at(-1)?.id).toBe(a);
    expect(reorderObject(session.snapshot.model, a, 'front')).toBeNull();

    session.execute(
      reshapeObject(session.snapshot.model, b, lookup, (d) => ({ ...d, width: 99 }), 0)!,
    );
    expect(session.snapshot.model.objects.find((o) => o.id === b)?.frame.width).toBe(99);

    session.execute(removeSelection(session.snapshot.model, [a, b])!);
    expect(session.snapshot.model.objects).toHaveLength(1);
    expect(removeSelection(session.snapshot.model, ['missing'])).toBeNull();
  });
});
