import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyToPoint, pdfToDisplayMatrix } from '../../src/domain/geometry';
import type { DocumentInfo } from '../../src/domain/document';
import { MupdfEngine } from '../../src/infrastructure/mupdf/MupdfEngine';
import {
  corruptedPdf,
  encryptedPdf,
  EXTERNAL_LINK,
  linkPdf,
  longPdf,
  notPdfBytes,
  POLISH_SENTENCE,
  polishPdf,
  rotatedPdf,
  samplePdf,
} from '../fixtures/pdfFactory';

let engine: MupdfEngine;

beforeAll(() => {
  engine = new MupdfEngine(mupdf);
});

function openOk(bytes: Uint8Array, password?: string): DocumentInfo {
  const result = engine.open(bytes, password);
  if (!result.ok || result.value.status !== 'opened') {
    throw new Error(`Expected document to open: ${JSON.stringify(result)}`);
  }
  return result.value.document;
}

describe('opening documents', () => {
  it('reads page count and sizes', () => {
    const info = openOk(polishPdf());
    expect(info.pages).toHaveLength(2);
    expect(info.pages[0]!.cropBox).toEqual({ x: 0, y: 0, width: 595, height: 842 });
    expect(info.isEncrypted).toBe(false);
    engine.close(info.id);
  });

  it('asks for a password and rejects a wrong one', () => {
    const bytes = encryptedPdf('matura2026');
    expect(engine.open(bytes)).toEqual({
      ok: true,
      value: { status: 'password-required', wrongPassword: false },
    });
    expect(engine.open(bytes, 'zle-haslo')).toEqual({
      ok: true,
      value: { status: 'password-required', wrongPassword: true },
    });
    const info = openOk(bytes, 'matura2026');
    expect(info.isEncrypted).toBe(true);
    const text = engine.getPageText(info.id, 0);
    expect(text.ok && text.value).toContain('ściśle poufne');
    engine.close(info.id);
  });

  it('reports a file that is not a PDF', () => {
    const result = engine.open(notPdfBytes());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe('not-a-pdf');
  });

  it('reports a damaged PDF instead of crashing', () => {
    const result = engine.open(corruptedPdf());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe('file-corrupted');
  });

  it('refuses to work on a closed document', () => {
    const info = openOk(polishPdf());
    engine.close(info.id);
    const result = engine.renderPage(info.id, 0, 1);
    expect(!result.ok && result.code).toBe('document-closed');
  });

  it('never runs JavaScript embedded in a PDF', () => {
    const doc = mupdf.Document.openDocument(polishPdf(), 'application/pdf').asPDF();
    expect(doc?.isJSSupported()).toBe(false);
  });
});

describe('rendering', () => {
  it('renders a page with the expected pixel size and visible content', () => {
    const info = openOk(polishPdf());
    const result = engine.renderPage(info.id, 0, 2);
    if (!result.ok) {
      throw new Error(result.detail);
    }
    const { width, height, pixels } = result.value;
    expect(width).toBe(1190);
    expect(height).toBe(1684);
    expect(pixels.length).toBe(width * height * 4);
    const darkPixels = pixels.filter((value, i) => i % 4 === 0 && value < 128).length;
    expect(darkPixels).toBeGreaterThan(100);
    engine.close(info.id);
  });

  it('caps huge renders to protect memory', () => {
    const info = openOk(polishPdf());
    const result = engine.renderPage(info.id, 0, 50);
    expect(result.ok && result.value.width * result.value.height).toBeLessThanOrEqual(25_100_000);
    engine.close(info.id);
  });
});

describe('page geometry', () => {
  it('matches MuPDF for rotated pages with an offset crop box', () => {
    const bytes = rotatedPdf();
    const info = openOk(bytes);
    const doc = new mupdf.PDFDocument(bytes);
    for (const page of info.pages) {
      expect(page.cropBox).toEqual({ x: 20, y: 40, width: 500, height: 760 });
      const mupdfPage = doc.loadPage(page.index);
      const engineMatrix = mupdfPage.getTransform();
      const [bx, by] = mupdfPage.getBounds();
      const ours = pdfToDisplayMatrix(page.cropBox, page.rotation);
      for (const point of [
        { x: 20, y: 40 },
        { x: 520, y: 800 },
        { x: 100, y: 300 },
      ]) {
        const expected = applyToPoint(engineMatrix, point);
        const actual = applyToPoint(ours, point);
        expect(actual.x).toBeCloseTo(expected.x - bx, 3);
        expect(actual.y).toBeCloseTo(expected.y - by, 3);
      }
    }
    expect(info.pages.map((p) => p.rotation)).toEqual([0, 90, 180, 270]);
    engine.close(info.id);
  });
});

describe('text', () => {
  it('extracts Polish characters in display coordinates', () => {
    const info = openOk(polishPdf());
    const result = engine.getTextLines(info.id, 0);
    if (!result.ok) {
      throw new Error(result.detail);
    }
    const line = result.value.find((l) => l.text.includes('Zażółć'));
    expect(line?.text.trim()).toBe(POLISH_SENTENCE);
    // Baseline at PDF y = 740 → display y ≈ 842 − 740 − ascent.
    expect(line!.bbox.y).toBeGreaterThan(80);
    expect(line!.bbox.y).toBeLessThan(102);
    expect(line!.fontFamily).toBe('sans-serif');
    expect(line!.vertical).toBe(false);
    engine.close(info.id);
  });

  it('reads the LaTeX sample sheet with Polish letters and math', () => {
    const info = openOk(samplePdf());
    const text = engine.getPageText(info.id, 0);
    expect(text.ok && text.value).toContain('zażółć gęślą jaźń');
    expect(text.ok && text.value).toContain('ZAŻÓŁĆ GĘŚLĄ JAŹŃ');
    engine.close(info.id);
  });

  it('searches case-insensitively and returns context', () => {
    const info = openOk(polishPdf());
    const result = engine.search(info.id, 'GĘŚLĄ', 100);
    if (!result.ok) {
      throw new Error(result.detail);
    }
    expect(result.value.hits).toHaveLength(2);
    expect(result.value.hits[0]!.pageIndex).toBe(0);
    expect(result.value.hits[0]!.context).toContain('Zażółć gęślą');
    expect(result.value.hits[0]!.rects.length).toBeGreaterThan(0);
    expect(result.value.truncated).toBe(false);
    engine.close(info.id);
  });

  it('stops at the hit limit', () => {
    const info = openOk(longPdf(20));
    const result = engine.search(info.id, 'Strona', 5);
    expect(result.ok && result.value.hits).toHaveLength(5);
    expect(result.ok && result.value.truncated).toBe(true);
    engine.close(info.id);
  });
});

describe('links', () => {
  it('returns external links and internal page targets', () => {
    const info = openOk(linkPdf());
    const result = engine.getLinks(info.id, 0);
    if (!result.ok) {
      throw new Error(result.detail);
    }
    const targets = result.value.map((l) => l.target);
    expect(targets).toContainEqual({ kind: 'external', uri: EXTERNAL_LINK });
    expect(targets).toContainEqual({ kind: 'page', pageIndex: 1 });
    engine.close(info.id);
  });
});

describe('performance', () => {
  it('opens a 300-page document and renders the first page quickly', () => {
    const bytes = longPdf(300);
    const start = performance.now();
    const info = openOk(bytes);
    const render = engine.renderPage(info.id, 0, 1.5);
    const elapsed = performance.now() - start;
    expect(info.pages).toHaveLength(300);
    expect(render.ok).toBe(true);
    expect(elapsed).toBeLessThan(2000);
    engine.close(info.id);
  });
});
