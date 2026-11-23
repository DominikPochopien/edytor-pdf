import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ExportResources, TextLayoutResult } from '../../src/application/ports';
import { DEFAULT_TEXT_STYLE } from '../../src/application/use-cases';
import type { DocumentInfo, PageInfo } from '../../src/domain/document';
import type { FontKey } from '../../src/domain/fonts';
import type { TextObject, TextStyle, WhiteoutRect } from '../../src/domain/objects';
import { baselineOffset, displayToFrame, textBlockHeight } from '../../src/domain/objects';
import { MupdfEngine } from '../../src/infrastructure/mupdf/MupdfEngine';
import { polishPdf, POLISH_SENTENCE, rotatedPdf, samplePdf } from '../fixtures/pdfFactory';
import { QPDF_AVAILABLE, qpdfCheck } from './qpdf';

const FONT_FILES: Record<string, string> = {
  'noto-sans:regular': 'noto-sans/NotoSans-regular.ttf',
  'noto-sans:bold': 'noto-sans/NotoSans-bold.ttf',
  'latin-modern:regular': 'latin-modern/LatinModernRoman-regular.otf',
};

function fontBytes(key: string): Uint8Array {
  const file = FONT_FILES[key];
  if (file === undefined) {
    throw new Error(key);
  }
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../../public/fonts/${file}`, import.meta.url))),
  );
}

let engine: MupdfEngine;
let counter = 0;

beforeAll(() => {
  engine = new MupdfEngine(mupdf);
});

function open(bytes: Uint8Array): DocumentInfo {
  const result = engine.open(bytes);
  if (!result.ok || result.value.status !== 'opened') {
    throw new Error(JSON.stringify(result));
  }
  return result.value.document;
}

/** Line layout as the editing layer would produce it (widths measured with MuPDF here). */
function layoutOf(lines: string[], style: TextStyle, key: FontKey): TextLayoutResult {
  const font = new mupdf.Font('m', fontBytes(key));
  const width = (text: string): number =>
    Array.from(text).reduce(
      (sum, c) => sum + font.advanceGlyph(font.encodeCharacter(c.codePointAt(0) ?? 0)),
      0,
    ) * style.fontSize;
  return {
    lines: lines.map((text, i) => ({
      text,
      width: width(text),
      endsParagraph: i === lines.length - 1,
    })),
    height: textBlockHeight(style.fontSize, style.lineHeight, lines.length),
  };
}

function textBox(
  page: PageInfo,
  topLeft: { x: number; y: number },
  lines: string[],
  style: Partial<TextStyle> = {},
  width = 300,
): { object: TextObject; resources: ExportResources } {
  const full = { ...DEFAULT_TEXT_STYLE, fontSize: 14, ...style };
  const key: FontKey = `${full.fontFamily}:${full.bold ? 'bold' : 'regular'}`;
  const layout = layoutOf(lines, full, key);
  const object: TextObject = {
    id: `text-${++counter}`,
    kind: 'text',
    pageIndex: page.index,
    frame: displayToFrame(
      {
        center: { x: topLeft.x + width / 2, y: topLeft.y + layout.height / 2 },
        width,
        height: layout.height,
        angle: 0,
      },
      page,
    ),
    opacity: 1,
    text: lines.join(' '),
    style: full,
  };
  return {
    object,
    resources: { fonts: { [key]: fontBytes(key) }, texts: { [object.id]: { layout, font: key } } },
  };
}

function exportOk(
  info: DocumentInfo,
  objects: (TextObject | WhiteoutRect)[],
  resources: ExportResources,
): Uint8Array {
  const result = engine.exportDocument(info.id, objects, resources);
  if (!result.ok) {
    throw new Error(result.detail);
  }
  return result.value;
}

interface CharInfo {
  readonly c: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
}

function characters(bytes: Uint8Array, pageIndex: number): CharInfo[] {
  const doc = new mupdf.PDFDocument(bytes);
  const page = doc.loadPage(pageIndex);
  const chars: CharInfo[] = [];
  page.toStructuredText('preserve-whitespace').walk({
    onChar: (c, origin, font) => {
      chars.push({ c, x: origin[0], y: origin[1], font: font.getName() });
    },
  });
  return chars;
}

function findLine(chars: CharInfo[], text: string): CharInfo[] {
  const joined = chars.map((c) => c.c).join('');
  const at = joined.indexOf(text);
  expect(at, `"${text}" not found in "${joined}"`).toBeGreaterThanOrEqual(0);
  return chars.slice(at, at + text.length);
}

describe('saving text', () => {
  it('writes Polish text with an embedded font subset, on the expected baseline', () => {
    const info = open(polishPdf());
    const page = info.pages[0]!;
    const added = `Dopisane: ${POLISH_SENTENCE}`;
    const { object, resources } = textBox(page, { x: 100, y: 300 }, [added]);
    const saved = exportOk(info, [object], resources);
    const line = findLine(characters(saved, 0), added);
    expect(line[0]!.x).toBeCloseTo(100, 0);
    expect(line[0]!.y).toBeCloseTo(300 + baselineOffset(14, DEFAULT_TEXT_STYLE.lineHeight, 0), 0);
    // The font is embedded as a subset ("ABCDEF+Name").
    expect(line[0]!.font).toMatch(/^[A-Z]{6}\+/);
    if (QPDF_AVAILABLE) {
      expect(qpdfCheck(saved).status).toBe(0);
    }
  });

  it('keeps line breaks and line spacing of the layout', () => {
    const info = open(polishPdf());
    const style = { lineHeight: 1.5 };
    const { object, resources } = textBox(
      info.pages[0]!,
      { x: 100, y: 300 },
      ['Pierwsza linia', 'Druga linia – ąę'],
      style,
    );
    const chars = characters(exportOk(info, [object], resources), 0);
    const first = findLine(chars, 'Pierwsza linia');
    const second = findLine(chars, 'Druga linia – ąę');
    const advance = baselineOffset(14, 1.5, 1) - baselineOffset(14, 1.5, 0);
    expect(second[0]!.y - first[0]!.y).toBeCloseTo(advance, 0);
    expect(second[0]!.x).toBeCloseTo(100, 0);
  });

  it('aligns lines to the right and centre of the box', () => {
    const info = open(polishPdf());
    const page = info.pages[0]!;
    const right = textBox(page, { x: 100, y: 300 }, ['do prawej'], { align: 'right' });
    const center = textBox(page, { x: 100, y: 400 }, ['środek'], { align: 'center' });
    const resources: ExportResources = {
      fonts: { ...right.resources.fonts, ...center.resources.fonts },
      texts: { ...right.resources.texts, ...center.resources.texts },
    };
    const chars = characters(exportOk(info, [right.object, center.object], resources), 0);
    const rightLine = findLine(chars, 'do prawej');
    const lineWidth = right.resources.texts[right.object.id]!.layout.lines[0]!.width;
    expect(rightLine[0]!.x).toBeCloseTo(100 + 300 - lineWidth, 0);
    const centerLine = findLine(chars, 'środek');
    const centerWidth = center.resources.texts[center.object.id]!.layout.lines[0]!.width;
    expect(centerLine[0]!.x).toBeCloseTo(100 + (300 - centerWidth) / 2, 0);
  });

  it('stretches justified lines to the full width, except the last one', () => {
    const info = open(polishPdf());
    const lines = ['Źrebię, żółwie i gęsi tak dalej', 'koniec'];
    const { object, resources } = textBox(info.pages[0]!, { x: 100, y: 300 }, lines, {
      align: 'justify',
    });
    const chars = characters(exportOk(info, [object], resources), 0);
    const first = findLine(chars, 'Źrebię');
    const lastWord = findLine(chars, 'dalej');
    const font = new mupdf.Font('m', fontBytes('noto-sans:regular'));
    const lastCharWidth = font.advanceGlyph(font.encodeCharacter('j'.codePointAt(0)!)) * 14;
    expect(lastWord.at(-1)!.x + lastCharWidth).toBeCloseTo(400, 0);
    expect(first[0]!.x).toBeCloseTo(100, 0);
    const end = findLine(chars, 'koniec');
    expect(end[0]!.x).toBeCloseTo(100, 0);
  });

  it('writes upright text on rotated pages', () => {
    const info = open(rotatedPdf());
    const page = info.pages[1]!;
    const { object, resources } = textBox(page, { x: 50, y: 60 }, ['obrócona ąę']);
    const saved = exportOk(info, [object], resources);
    const doc = new mupdf.PDFDocument(saved);
    let direction: number[] = [];
    doc
      .loadPage(1)
      .toStructuredText('preserve-whitespace')
      .walk({
        beginLine: (_bbox, _wmode, dir) => {
          direction = dir;
        },
      });
    // In display space (MuPDF's page space) the line runs left to right.
    const chars = characters(saved, 1);
    const line = findLine(chars, 'obrócona ąę');
    expect(line[0]!.x).toBeCloseTo(50, 0);
    expect(direction[0]).toBeCloseTo(1);
  });

  it('adds text in Latin Modern to a LaTeX exam sheet', () => {
    const info = open(samplePdf());
    const { object, resources } = textBox(
      info.pages[0]!,
      { x: 70, y: 760 },
      ['Imię i nazwisko: Józef Żółć'],
      {
        fontFamily: 'latin-modern',
        fontSize: 11,
      },
    );
    const saved = exportOk(info, [object], resources);
    const text = new mupdf.PDFDocument(saved)
      .loadPage(0)
      .toStructuredText('preserve-whitespace')
      .asText();
    expect(text).toContain('Imię i nazwisko: Józef Żółć');
    expect(text).toContain('zażółć gęślą jaźń');
    if (QPDF_AVAILABLE) {
      expect(qpdfCheck(saved).status).toBe(0);
    }
  });
});

describe('saving whiteout', () => {
  it('covers content visually but does not remove the text underneath', () => {
    const info = open(polishPdf());
    const page = info.pages[0]!;
    // The Polish sentence is at PDF y = 740 → display y ≈ 102 (baseline).
    const whiteout: WhiteoutRect = {
      id: 'w1',
      kind: 'whiteout',
      pageIndex: 0,
      frame: displayToFrame({ center: { x: 297, y: 97 }, width: 594, height: 30, angle: 0 }, page),
      opacity: 1,
      color: '#ffffff',
    };
    const saved = exportOk(info, [whiteout], { fonts: {}, texts: {} });
    const reopened = open(saved);
    const render = engine.renderPage(reopened.id, 0, 1);
    if (!render.ok) {
      throw new Error(render.detail);
    }
    const { width, pixels } = render.value;
    let dark = 0;
    for (let y = 85; y < 110; y++) {
      for (let x = 72; x < 400; x++) {
        if ((pixels[(y * width + x) * 4] ?? 255) < 128) {
          dark += 1;
        }
      }
    }
    expect(dark).toBe(0);
    const text = engine.getPageText(reopened.id, 0);
    expect(text.ok && text.value).toContain('Zażółć gęślą jaźń');
  });
});
