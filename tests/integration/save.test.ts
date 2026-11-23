import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { NO_EXPORT_RESOURCES } from '../../src/application/ports';
import type { DocumentInfo, PageInfo } from '../../src/domain/document';
import type { ShapeObject } from '../../src/domain/objects';
import { displayToFrame } from '../../src/domain/objects';
import { MupdfEngine } from '../../src/infrastructure/mupdf/MupdfEngine';
import { annotatedPdf, encryptedPdf, polishPdf, rotatedPdf } from '../fixtures/pdfFactory';
import { QPDF_AVAILABLE, qpdfCheck } from './qpdf';

let engine: MupdfEngine;
let counter = 0;

beforeAll(() => {
  engine = new MupdfEngine(mupdf);
});

function open(bytes: Uint8Array, password?: string): DocumentInfo {
  const result = engine.open(bytes, password);
  if (!result.ok || result.value.status !== 'opened') {
    throw new Error(JSON.stringify(result));
  }
  return result.value.document;
}

/** A filled square shown at display position (x, y) on the page, upright on the screen. */
function squareAt(page: PageInfo, x: number, y: number, fill = '#ff0000'): ShapeObject {
  return {
    id: `obj-${++counter}`,
    kind: 'shape',
    shape: 'rectangle',
    pageIndex: page.index,
    frame: displayToFrame({ center: { x, y }, width: 40, height: 20, angle: 0 }, page),
    opacity: 1,
    stroke: '#0000ff',
    fill,
    strokeWidth: 2,
  };
}

function exportOk(info: DocumentInfo, objects: ShapeObject[]): Uint8Array {
  const result = engine.exportDocument(info.id, objects, NO_EXPORT_RESOURCES);
  if (!result.ok) {
    throw new Error(result.detail);
  }
  return result.value;
}

/** RGB of the pixel at display position (x, y) of a page rendered at 1 px per point. */
function pixelAt(id: string, pageIndex: number, x: number, y: number): number[] {
  const result = engine.renderPage(id, pageIndex, 1);
  if (!result.ok) {
    throw new Error(result.detail);
  }
  const { width, pixels } = result.value;
  const offset = (Math.round(y) * width + Math.round(x)) * 4;
  return Array.from(pixels.slice(offset, offset + 3));
}

const RED = [255, 0, 0];
const WHITE = [255, 255, 255];

describe('saving with objects (round trip)', () => {
  it('draws objects at the place shown on screen and keeps the original text', () => {
    const info = open(polishPdf());
    const saved = exportOk(info, [squareAt(info.pages[0]!, 300, 400)]);
    const reopened = open(saved);
    expect(reopened.pages).toHaveLength(2);
    expect(pixelAt(reopened.id, 0, 300, 400)).toEqual(RED);
    expect(pixelAt(reopened.id, 0, 300, 450)).toEqual(WHITE);
    const text = engine.getPageText(reopened.id, 0);
    expect(text.ok && text.value).toContain('Zażółć gęślą jaźń');
    engine.close(info.id);
    engine.close(reopened.id);
  });

  it('never changes the open document (non-destructive editing)', () => {
    const info = open(polishPdf());
    exportOk(info, [squareAt(info.pages[0]!, 300, 400)]);
    expect(pixelAt(info.id, 0, 300, 400)).toEqual(WHITE);
    engine.close(info.id);
  });

  it('places objects correctly on rotated pages with a shifted crop box', () => {
    const info = open(rotatedPdf());
    const objects = info.pages.map((page) => squareAt(page, 200, 150));
    const reopened = open(exportOk(info, objects));
    for (const page of reopened.pages) {
      expect(pixelAt(reopened.id, page.index, 200, 150)).toEqual(RED);
      expect(pixelAt(reopened.id, page.index, 200, 200)).toEqual(WHITE);
    }
    engine.close(info.id);
    engine.close(reopened.id);
  });

  it('keeps annotations made by other programs', () => {
    const info = open(annotatedPdf());
    const saved = exportOk(info, [squareAt(info.pages[0]!, 100, 100)]);
    const doc = new mupdf.PDFDocument(saved);
    const annotations = doc.loadPage(0).getAnnotations();
    expect(annotations.map((a) => a.getType())).toEqual(['Text']);
    expect(annotations[0]?.getContents()).toBe('Notatka recenzenta');
    engine.close(info.id);
  });

  it('can save an already edited file again', () => {
    const info = open(polishPdf());
    const first = open(exportOk(info, [squareAt(info.pages[0]!, 100, 100)]));
    const second = open(exportOk(first, [squareAt(first.pages[0]!, 300, 300, '#00ff00')]));
    expect(pixelAt(second.id, 0, 100, 100)).toEqual(RED);
    expect(pixelAt(second.id, 0, 300, 300)).toEqual([0, 255, 0]);
    for (const id of [info.id, first.id, second.id]) {
      engine.close(id);
    }
  });

  it('keeps a password-protected file protected', () => {
    const info = open(encryptedPdf('matura'), 'matura');
    const saved = exportOk(info, [squareAt(info.pages[0]!, 200, 200)]);
    expect(engine.open(saved)).toMatchObject({ ok: true, value: { status: 'password-required' } });
    const reopened = open(saved, 'matura');
    expect(pixelAt(reopened.id, 0, 200, 200)).toEqual(RED);
    engine.close(info.id);
    engine.close(reopened.id);
  });

  it('respects opacity and missing fill', () => {
    const info = open(polishPdf());
    const half: ShapeObject = { ...squareAt(info.pages[0]!, 300, 400), opacity: 0.5 };
    const outline: ShapeObject = { ...squareAt(info.pages[0]!, 300, 600), fill: null };
    const reopened = open(exportOk(info, [half, outline]));
    const [r, g, b] = pixelAt(reopened.id, 0, 300, 400);
    expect(r).toBe(255);
    expect(g).toBeGreaterThan(100);
    expect(g).toBeLessThan(160);
    expect(b).toBe(g);
    expect(pixelAt(reopened.id, 0, 300, 600)).toEqual(WHITE);
    engine.close(info.id);
    engine.close(reopened.id);
  });

  it.runIf(QPDF_AVAILABLE)('produces files that pass qpdf --check', () => {
    const info = open(rotatedPdf());
    const saved = exportOk(
      info,
      info.pages.map((page) => squareAt(page, 120, 120)),
    );
    const check = qpdfCheck(saved);
    expect(check.output).toContain('No syntax or stream encoding errors');
    expect(check.status).toBe(0);
    engine.close(info.id);
  });
});
