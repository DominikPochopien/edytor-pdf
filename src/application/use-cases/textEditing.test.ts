import { describe, expect, it, vi } from 'vitest';
import type { PageInfo } from '../../domain/document';
import type { FontFamilyInfo } from '../../domain/fonts';
import type { TextObject, TextStyle } from '../../domain/objects';
import { frameToDisplay, textBlockHeight } from '../../domain/objects';
import { EditorSession } from '../commands';
import type { FontProvider, TextLayoutEngine } from '../ports';
import {
  createText,
  DEFAULT_TEXT_STYLE,
  editText,
  prepareExportResources,
  restyleText,
  textFontKey,
  withHeightKeepingTop,
} from './textEditing';

const page: PageInfo = { index: 0, rotation: 0, cropBox: { x: 0, y: 0, width: 595, height: 842 } };
const lookup = (): PageInfo => page;

/** Fake layout: one line per 10 characters that fit in the width at 0.5 em per character. */
const layout: TextLayoutEngine = {
  layout: (text: string, style: TextStyle, width: number) => {
    const perLine = Math.max(1, Math.floor(width / (style.fontSize * 0.5)));
    const count = Math.max(1, Math.ceil(text.length / perLine));
    const lines = Array.from({ length: count }, (_, i) => ({
      text: text.slice(i * perLine, (i + 1) * perLine),
      width: Math.min(width, text.length * style.fontSize * 0.5),
      endsParagraph: i === count - 1,
    }));
    return { lines, height: textBlockHeight(style.fontSize, style.lineHeight, count) };
  },
};

const families: Record<string, FontFamilyInfo> = {
  'noto-sans': {
    id: 'noto-sans',
    name: 'Noto Sans',
    category: 'sans-serif',
    styles: ['regular', 'bold', 'italic', 'bold-italic'],
  },
  mine: { id: 'mine', name: 'Mój', category: 'custom', styles: ['regular'] },
};

function fontProvider(): FontProvider {
  return {
    families: () => Object.values(families),
    family: (id) => families[id],
    cssFamily: (id) => `css-${id}`,
    ensureLoaded: vi.fn(() => Promise.resolve()),
    getBytes: vi.fn((key: string) => Promise.resolve(new TextEncoder().encode(key))),
    addFamily: vi.fn(),
    subscribe: () => () => undefined,
  };
}

function setup() {
  const session = new EditorSession();
  let n = 0;
  return { session, newId: () => `t${++n}` };
}

const box = { center: { x: 200, y: 100 }, width: 100, height: 20, angle: 0 };

function onlyText(session: EditorSession): TextObject {
  const object = session.snapshot.model.objects[0];
  if (object?.kind !== 'text') {
    throw new Error('no text');
  }
  return object;
}

describe('text use cases', () => {
  it('does not create empty text boxes', () => {
    expect(createText(page, box, '   ', DEFAULT_TEXT_STYLE, () => 'x')).toBeNull();
  });

  it('creates, edits and removes text through undoable commands', () => {
    const { session, newId } = setup();
    session.execute(createText(page, box, 'Zażółć', DEFAULT_TEXT_STYLE, newId)!);
    expect(onlyText(session).text).toBe('Zażółć');
    session.execute(editText(session.snapshot.model, 't1', 'gęślą jaźń', box, lookup)!);
    expect(onlyText(session).text).toBe('gęślą jaźń');
    expect(editText(session.snapshot.model, 't1', 'gęślą jaźń', box, lookup)).toBeNull();
    session.execute(editText(session.snapshot.model, 't1', '', box, lookup)!);
    expect(session.snapshot.model.objects).toHaveLength(0);
    session.undo();
    session.undo();
    expect(onlyText(session).text).toBe('Zażółć');
  });

  it('recalculates the height when the style changes, keeping the top edge in place', () => {
    const { session, newId } = setup();
    const text = 'a'.repeat(30);
    session.execute(
      createText(
        page,
        { ...box, height: textBlockHeight(12, 1.16, 2) },
        text,
        DEFAULT_TEXT_STYLE,
        newId,
      )!,
    );
    const before = frameToDisplay(onlyText(session).frame, page);
    session.execute(
      restyleText(session.snapshot.model, 't1', lookup, layout, { style: { fontSize: 24 } }, 0)!,
    );
    const after = frameToDisplay(onlyText(session).frame, page);
    expect(after.height).toBeGreaterThan(before.height);
    expect(after.center.y - after.height / 2).toBeCloseTo(before.center.y - before.height / 2);
    expect(onlyText(session).style.fontSize).toBe(24);
  });

  it('keeps the top edge of rotated boxes', () => {
    const rotated = withHeightKeepingTop(
      { center: { x: 0, y: 0 }, width: 10, height: 10, angle: 90 },
      20,
    );
    // Rotated 90° clockwise, the box "top" faces right, so the centre moves left.
    expect(rotated.center.x).toBeCloseTo(-5);
    expect(rotated.center.y).toBeCloseTo(0);
  });

  it('falls back to the regular face when a family has no bold', () => {
    const fonts = fontProvider();
    expect(textFontKey({ ...DEFAULT_TEXT_STYLE, bold: true }, fonts)).toBe('noto-sans:bold');
    expect(textFontKey({ ...DEFAULT_TEXT_STYLE, fontFamily: 'mine', bold: true }, fonts)).toBe(
      'mine:regular',
    );
  });

  it('collects font files and line breaks for saving', async () => {
    const { session, newId } = setup();
    session.execute(createText(page, box, 'pierwszy', DEFAULT_TEXT_STYLE, newId)!);
    session.execute(createText(page, box, 'drugi', { ...DEFAULT_TEXT_STYLE, bold: true }, newId)!);
    const fonts = fontProvider();
    const resources = await prepareExportResources(session.snapshot.model.objects, fonts, () =>
      Promise.resolve(layout),
    );
    expect(Object.keys(resources.fonts).sort()).toEqual(['noto-sans:bold', 'noto-sans:regular']);
    expect(resources.texts.t2?.font).toBe('noto-sans:bold');
    expect(resources.texts.t1?.layout.lines[0]?.text).toBe('pierwszy');
    expect(fonts.ensureLoaded).toHaveBeenCalled();
  });

  it('needs nothing for documents without text', async () => {
    const fonts = fontProvider();
    expect(
      await prepareExportResources([], fonts, () => Promise.reject(new Error('unused'))),
    ).toEqual({ fonts: {}, texts: {} });
  });
});
