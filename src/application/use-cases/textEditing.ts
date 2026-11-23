import type { PageInfo } from '../../domain/document';
import { availableStyle, fontKey } from '../../domain/fonts';
import type { FontKey } from '../../domain/fonts';
import type {
  DisplayFrame,
  EditModel,
  EditObject,
  ObjectId,
  TextObject,
  TextStyle,
} from '../../domain/objects';
import { displayToFrame, findObject, frameToDisplay } from '../../domain/objects';
import type { Command } from '../commands';
import { AddObjectsCommand, RemoveObjectsCommand, UpdateObjectsCommand } from '../commands';
import type { ExportResources, FontProvider, TextExportInfo, TextLayoutEngine } from '../ports';
import type { IdGenerator, PageLookup } from './objectEditing';
import { MERGE_WINDOW_MS } from './objectEditing';

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'noto-sans',
  fontSize: 12,
  color: '#000000',
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  lineHeight: 1.16,
};

/** Width of a new text box created with a single click, in points. */
export const DEFAULT_TEXT_WIDTH = 220;

/** The font file a text box needs (bold/italic fall back to regular when the family lacks them). */
export function textFontKey(style: TextStyle, fonts: Pick<FontProvider, 'family'>): FontKey {
  const family = fonts.family(style.fontFamily);
  const styleKey =
    family === undefined ? 'regular' : availableStyle(family, style.bold, style.italic);
  return fontKey(style.fontFamily, styleKey);
}

export function createText(
  page: PageInfo,
  display: DisplayFrame,
  text: string,
  style: TextStyle,
  newId: IdGenerator,
): Command | null {
  if (text.trim() === '') {
    return null;
  }
  const object: TextObject = {
    id: newId(),
    kind: 'text',
    pageIndex: page.index,
    frame: displayToFrame(display, page),
    opacity: 1,
    text,
    style,
  };
  return new AddObjectsCommand([object]);
}

/** Finishing an edit: new text (and the frame the layer measured), or removal when emptied. */
export function editText(
  model: EditModel,
  id: ObjectId,
  text: string,
  display: DisplayFrame,
  pages: PageLookup,
): Command | null {
  const object = findObject(model, id);
  const page = object === undefined ? undefined : pages(object.pageIndex);
  if (object?.kind !== 'text' || page === undefined) {
    return null;
  }
  if (text.trim() === '') {
    return new RemoveObjectsCommand(model, [id]);
  }
  if (text === object.text) {
    return null;
  }
  return new UpdateObjectsCommand(
    [object],
    [{ ...object, text, frame: displayToFrame(display, page) }],
    'edit-text',
  );
}

/** Changes the height of a frame while its top edge stays where the reader sees it. */
export function withHeightKeepingTop(display: DisplayFrame, height: number): DisplayFrame {
  const delta = (height - display.height) / 2;
  const radians = (display.angle * Math.PI) / 180;
  return {
    ...display,
    height,
    center: {
      x: display.center.x - delta * Math.sin(radians),
      y: display.center.y + delta * Math.cos(radians),
    },
  };
}

/** Applies a new style and/or width to a text box and recalculates its height. */
export function relayoutText(
  object: TextObject,
  page: PageInfo,
  layout: TextLayoutEngine,
  change: { readonly style?: Partial<TextStyle>; readonly width?: number },
): TextObject {
  const style = { ...object.style, ...change.style };
  const display = frameToDisplay(object.frame, page);
  const width = change.width ?? display.width;
  const { height } = layout.layout(object.text, style, width);
  const resized = withHeightKeepingTop({ ...display, width }, height);
  return { ...object, style, frame: displayToFrame(resized, page) };
}

export function restyleText(
  model: EditModel,
  id: ObjectId,
  pages: PageLookup,
  layout: TextLayoutEngine,
  change: { readonly style?: Partial<TextStyle>; readonly width?: number },
  now: number,
): Command | null {
  const object = findObject(model, id);
  const page = object === undefined ? undefined : pages(object.pageIndex);
  if (object?.kind !== 'text' || page === undefined) {
    return null;
  }
  const field = [
    ...Object.keys(change.style ?? {}),
    ...(change.width === undefined ? [] : ['width']),
  ].join(',');
  return new UpdateObjectsCommand([object], [relayoutText(object, page, layout, change)], 'style', {
    key: `text:${id}:${field}`,
    at: now,
    windowMs: MERGE_WINDOW_MS,
  });
}

/** Fonts and line breaks needed to write the given objects into a PDF. */
export async function prepareExportResources(
  objects: readonly EditObject[],
  fonts: FontProvider,
  loadLayout: () => Promise<TextLayoutEngine>,
): Promise<ExportResources> {
  const texts = objects.filter((o): o is TextObject => o.kind === 'text');
  if (texts.length === 0) {
    return { fonts: {}, texts: {} };
  }
  const keys = [...new Set(texts.map((t) => textFontKey(t.style, fonts)))];
  await fonts.ensureLoaded(keys);
  const layout = await loadLayout();
  const fontFiles: Partial<Record<FontKey, Uint8Array>> = {};
  for (const key of keys) {
    fontFiles[key] = await fonts.getBytes(key);
  }
  const textInfo: Record<ObjectId, TextExportInfo> = {};
  for (const text of texts) {
    textInfo[text.id] = {
      layout: layout.layout(text.text, text.style, text.frame.width),
      font: textFontKey(text.style, fonts),
    };
  }
  return { fonts: fontFiles, texts: textInfo };
}
