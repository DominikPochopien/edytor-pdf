import type * as Mupdf from 'mupdf';
import type { AppErrorCode, Result } from '../../application/errors';
import { fail, ok } from '../../application/errors';
import type {
  DocumentId,
  DocumentInfo,
  FontFamilyKind,
  PageInfo,
  PageLink,
  SearchHit,
  SearchResult,
  TextLine,
} from '../../domain/document';
import type { Rect } from '../../domain/geometry';
import { normalizeRotation } from '../../domain/geometry';
import { classifyEngineError, looksLikePdf } from './engineErrors';

export type MupdfModule = typeof Mupdf;

/** Raw RGBA pixels of a rendered page, ready to become ImageData. */
export interface RawBitmap {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
}

export type EngineOpenResult =
  | { readonly status: 'opened'; readonly document: DocumentInfo }
  | { readonly status: 'password-required'; readonly wrongPassword: boolean };

/** Largest bitmap we render in one piece (≈ 100 MB of RGBA); bigger requests are scaled down. */
const MAX_RENDER_PIXELS = 25_000_000;
/** Number of parsed pages kept in memory per document. */
const PAGE_CACHE_SIZE = 8;
/** Characters of context shown on each side of a search hit. */
const SEARCH_CONTEXT_CHARS = 40;
/** Direction component below which a text line counts as horizontal. */
const HORIZONTAL_TOLERANCE = 0.01;
const WHITE = 255;
/** A PDF rectangle is an array of four numbers. */
const PDF_RECT_LENGTH = 4;
const STEXT_OPTIONS = 'preserve-whitespace';
/** Shown by MuPDF for glyphs without a Unicode mapping (common in LaTeX math fonts). */
const REPLACEMENT_CHARACTER = '\uFFFD';

interface OpenDocument {
  readonly doc: Mupdf.PDFDocument;
  readonly pages: Map<number, Mupdf.PDFPage>;
  readonly info: DocumentInfo;
}

function toRect([x0, y0, x1, y1]: readonly number[]): Rect {
  const left = x0 ?? 0;
  const top = y0 ?? 0;
  return { x: left, y: top, width: (x1 ?? left) - left, height: (y1 ?? top) - top };
}

function quadToRect(quad: Mupdf.Quad, origin: Rect): Rect {
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX - origin.x,
    y: minY - origin.y,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

const MONOSPACE_NAME = /mono|courier|typewriter|consol|\btt/i;
const SANS_NAME = /sans|arial|helvetica|verdana|roboto|lato|calibri|segoe|tahoma/i;

/** Embedded subsets often lack style flags, so the font name is checked first. */
function fontFamilyOf(font: Mupdf.Font): FontFamilyKind {
  const name = font.getName();
  if (MONOSPACE_NAME.test(name) || font.isMono()) {
    return 'monospace';
  }
  if (SANS_NAME.test(name)) {
    return 'sans-serif';
  }
  return font.isSerif() ? 'serif' : 'sans-serif';
}

/** Lower-cases one character while keeping the 1:1 mapping between text and boxes. */
function lowerChar(char: string): string {
  const lowered = char.toLocaleLowerCase('pl');
  return lowered.length === char.length ? lowered : char;
}

function normalizeForSearch(text: string): string {
  return Array.from(text.replace(/\s+/g, ' '), lowerChar).join('');
}

interface SearchIndex {
  /** Lower-cased text used for matching. */
  text: string;
  /** The same text with original letter case, used for the context snippet. */
  original: string;
  readonly boxes: (Rect | null)[];
  readonly lines: number[];
}

function unionRects(rects: readonly Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Finds every occurrence of `needle` (already normalized) and merges character boxes per line. */
function findInIndex(index: SearchIndex, needle: string): { rects: Rect[]; context: string }[] {
  const results: { rects: Rect[]; context: string }[] = [];
  let from = 0;
  for (;;) {
    const at = index.text.indexOf(needle, from);
    if (at === -1) {
      return results;
    }
    const byLine = new Map<number, Rect[]>();
    for (let i = at; i < at + needle.length; i++) {
      const box = index.boxes[i];
      const line = index.lines[i];
      if (box !== null && box !== undefined && line !== undefined) {
        byLine.set(line, [...(byLine.get(line) ?? []), box]);
      }
    }
    const start = Math.max(0, at - SEARCH_CONTEXT_CHARS);
    const end = Math.min(index.text.length, at + needle.length + SEARCH_CONTEXT_CHARS);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < index.text.length ? '…' : '';
    const snippet = index.original.slice(start, end).replaceAll(REPLACEMENT_CHARACTER, '').trim();
    results.push({
      rects: [...byLine.values()].map(unionRects),
      context: `${prefix}${snippet}${suffix}`,
    });
    from = at + needle.length;
  }
}

/**
 * All PDF work done with MuPDF. Runs inside the Web Worker in the app, and directly in Node.js
 * in integration tests. Every public method returns a Result instead of throwing, because
 * errors have to cross the worker boundary.
 */
export class MupdfEngine {
  private readonly documents = new Map<DocumentId, OpenDocument>();
  private sequence = 0;

  constructor(private readonly mupdf: MupdfModule) {}

  open(bytes: Uint8Array, password?: string): Result<EngineOpenResult> {
    return this.guard(() => {
      let doc: Mupdf.Document;
      try {
        doc = this.mupdf.Document.openDocument(bytes, 'application/pdf');
      } catch (error) {
        return this.openFailure(bytes, error);
      }
      const pdf = doc.asPDF();
      if (pdf === null) {
        doc.destroy();
        return fail('not-a-pdf', 'Document is not a PDF');
      }
      const encrypted = pdf.needsPassword();
      if (encrypted) {
        const authenticated = password !== undefined && pdf.authenticatePassword(password) !== 0;
        if (!authenticated) {
          pdf.destroy();
          return ok({ status: 'password-required', wrongPassword: password !== undefined });
        }
      }
      const pageCount = pdf.countPages();
      if (pageCount === 0) {
        pdf.destroy();
        return fail(looksLikePdf(bytes) ? 'file-corrupted' : 'not-a-pdf', 'Document has no pages');
      }
      const id = `doc-${++this.sequence}`;
      const info: DocumentInfo = {
        id,
        pages: this.readPageInfos(pdf, pageCount),
        metadata: {
          title: pdf.getMetaData('info:Title') ?? '',
          author: pdf.getMetaData('info:Author') ?? '',
        },
        isEncrypted: encrypted,
        wasRepaired: pdf.wasRepaired(),
      };
      this.documents.set(id, { doc: pdf, pages: new Map(), info });
      return ok({ status: 'opened', document: info });
    });
  }

  close(id: DocumentId): void {
    const entry = this.documents.get(id);
    if (entry === undefined) {
      return;
    }
    for (const page of entry.pages.values()) {
      page.destroy();
    }
    entry.doc.destroy();
    this.documents.delete(id);
  }

  /** Renders a page at `scale` pixels per point, on a white background. */
  renderPage(id: DocumentId, pageIndex: number, scale: number): Result<RawBitmap> {
    return this.withPage(id, pageIndex, (page) => {
      const bounds = toRect(page.getBounds());
      const requested = bounds.width * bounds.height * scale * scale;
      const effectiveScale =
        requested > MAX_RENDER_PIXELS ? scale * Math.sqrt(MAX_RENDER_PIXELS / requested) : scale;
      const width = Math.max(1, Math.ceil(bounds.width * effectiveScale));
      const height = Math.max(1, Math.ceil(bounds.height * effectiveScale));
      const { Matrix, ColorSpace, Pixmap, DrawDevice } = this.mupdf;
      const pixmap = new Pixmap(ColorSpace.DeviceRGB, [0, 0, width, height], true);
      try {
        pixmap.clear(WHITE);
        const ctm = Matrix.concat(
          Matrix.translate(-bounds.x, -bounds.y),
          Matrix.scale(effectiveScale, effectiveScale),
        );
        const device = new DrawDevice(ctm, pixmap);
        try {
          page.run(device, Matrix.identity);
          device.close();
        } finally {
          device.destroy();
        }
        // Copy out of WebAssembly memory before the pixmap is freed.
        const pixels = new Uint8ClampedArray(pixmap.getPixels());
        return ok({ width, height, pixels });
      } finally {
        pixmap.destroy();
      }
    });
  }

  getTextLines(id: DocumentId, pageIndex: number): Result<TextLine[]> {
    return this.withPage(id, pageIndex, (page) => {
      const origin = toRect(page.getBounds());
      const stext = page.toStructuredText(STEXT_OPTIONS);
      try {
        return ok(this.collectLines(stext, origin));
      } finally {
        stext.destroy();
      }
    });
  }

  getPageText(id: DocumentId, pageIndex: number): Result<string> {
    return this.withPage(id, pageIndex, (page) => {
      const stext = page.toStructuredText(STEXT_OPTIONS);
      try {
        return ok(stext.asText());
      } finally {
        stext.destroy();
      }
    });
  }

  search(id: DocumentId, query: string, maxHits: number): Result<SearchResult> {
    return this.guard(() => {
      const entry = this.documents.get(id);
      if (entry === undefined) {
        return fail('document-closed', id);
      }
      const needle = normalizeForSearch(query).trim();
      const hits: SearchHit[] = [];
      if (needle === '') {
        return ok({ hits, truncated: false });
      }
      for (const pageInfo of entry.info.pages) {
        const page = this.page(entry, pageInfo.index);
        const index = this.buildSearchIndex(page);
        for (const hit of findInIndex(index, needle)) {
          hits.push({ pageIndex: pageInfo.index, ...hit });
          if (hits.length >= maxHits) {
            return ok({ hits, truncated: true });
          }
        }
      }
      return ok({ hits, truncated: false });
    });
  }

  getLinks(id: DocumentId, pageIndex: number): Result<PageLink[]> {
    return this.withPage(id, pageIndex, (page, entry) => {
      const origin = toRect(page.getBounds());
      const links: PageLink[] = [];
      for (const link of page.getLinks()) {
        const box = toRect(link.getBounds());
        const bbox = { ...box, x: box.x - origin.x, y: box.y - origin.y };
        if (link.isExternal()) {
          links.push({ bbox, target: { kind: 'external', uri: link.getURI() } });
        } else {
          const target = entry.doc.resolveLink(link);
          if (target >= 0) {
            links.push({ bbox, target: { kind: 'page', pageIndex: target } });
          }
        }
      }
      return ok(links);
    });
  }

  private readPageInfos(pdf: Mupdf.PDFDocument, pageCount: number): PageInfo[] {
    const pages: PageInfo[] = [];
    for (let index = 0; index < pageCount; index++) {
      // findPage reads the page dictionary without parsing its content: fast for long documents.
      const pageObject = pdf.findPage(index);
      const mediaBox = this.readBox(pageObject.getInheritable('MediaBox')) ?? toRect([0, 0, 0, 0]);
      const cropBox = this.readBox(pageObject.getInheritable('CropBox')) ?? mediaBox;
      const rotate = pageObject.getInheritable('Rotate');
      pages.push({
        index,
        cropBox: this.intersect(cropBox, mediaBox),
        rotation: normalizeRotation(rotate.isNumber() ? rotate.asNumber() : 0),
      });
    }
    return pages;
  }

  private readBox(box: Mupdf.PDFObject): Rect | null {
    if (!box.isArray() || box.length < PDF_RECT_LENGTH) {
      return null;
    }
    const values: number[] = [];
    for (let i = 0; i < PDF_RECT_LENGTH; i++) {
      values.push(box.get(i).asNumber());
    }
    const [a = 0, b = 0, c = 0, d = 0] = values;
    return toRect([Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]);
  }

  private intersect(a: Rect, b: Rect): Rect {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.width, b.x + b.width);
    const y1 = Math.min(a.y + a.height, b.y + b.height);
    return x1 > x0 && y1 > y0 ? toRect([x0, y0, x1, y1]) : b;
  }

  private collectLines(stext: Mupdf.StructuredText, origin: Rect): TextLine[] {
    const lines: TextLine[] = [];
    let current: {
      bbox: Rect;
      vertical: boolean;
      text: string;
      font?: Mupdf.Font;
      size: number;
    } | null = null;
    stext.walk({
      beginLine: (bbox, wmode, direction) => {
        const box = toRect(bbox);
        current = {
          bbox: { ...box, x: box.x - origin.x, y: box.y - origin.y },
          vertical: wmode !== 0 || Math.abs(direction[1]) > HORIZONTAL_TOLERANCE,
          text: '',
          size: 0,
        };
      },
      onChar: (char, _origin, font, size) => {
        if (current === null) {
          return;
        }
        current.text += char;
        if (current.font === undefined) {
          current.font = font;
          current.size = size;
        }
      },
      endLine: () => {
        const line = current;
        current = null;
        if (line === null || line.text.trim() === '' || line.font === undefined) {
          return;
        }
        lines.push({
          text: line.text,
          bbox: line.bbox,
          fontSize: line.size,
          fontFamily: fontFamilyOf(line.font),
          bold: line.font.isBold(),
          italic: line.font.isItalic(),
          vertical: line.vertical,
        });
      },
    });
    return lines;
  }

  /** Text of a page with one display-space box per character, for our own search. */
  private buildSearchIndex(page: Mupdf.PDFPage): SearchIndex {
    const origin = toRect(page.getBounds());
    const stext = page.toStructuredText(STEXT_OPTIONS);
    const index: SearchIndex = { text: '', original: '', boxes: [], lines: [] };
    let line = -1;
    const push = (char: string, box: Rect | null): void => {
      const isSpace = /\s/.test(char);
      if (isSpace && (index.text === '' || index.text.endsWith(' '))) {
        return;
      }
      index.text += isSpace ? ' ' : lowerChar(char);
      index.original += isSpace ? ' ' : char;
      index.boxes.push(box);
      index.lines.push(line);
    };
    try {
      stext.walk({
        beginLine: () => {
          line += 1;
        },
        onChar: (char, _origin, _font, _size, quad) => {
          push(char, quadToRect(quad, origin));
        },
        endLine: () => {
          push(' ', null);
        },
      });
    } finally {
      stext.destroy();
    }
    return index;
  }

  private page(entry: OpenDocument, pageIndex: number): Mupdf.PDFPage {
    const cached = entry.pages.get(pageIndex);
    if (cached !== undefined) {
      entry.pages.delete(pageIndex);
      entry.pages.set(pageIndex, cached);
      return cached;
    }
    const page = entry.doc.loadPage(pageIndex);
    entry.pages.set(pageIndex, page);
    if (entry.pages.size > PAGE_CACHE_SIZE) {
      const [oldestIndex, oldest] = entry.pages.entries().next().value ?? [];
      if (oldestIndex !== undefined && oldest !== undefined) {
        entry.pages.delete(oldestIndex);
        oldest.destroy();
      }
    }
    return page;
  }

  private withPage<T>(
    id: DocumentId,
    pageIndex: number,
    action: (page: Mupdf.PDFPage, entry: OpenDocument) => Result<T>,
  ): Result<T> {
    return this.guard(() => {
      const entry = this.documents.get(id);
      if (entry === undefined) {
        return fail('document-closed', id);
      }
      if (pageIndex < 0 || pageIndex >= entry.info.pages.length) {
        return fail('render-failed', `Page ${pageIndex} out of range`);
      }
      return action(this.page(entry, pageIndex), entry);
    });
  }

  private openFailure<T>(bytes: Uint8Array, error: unknown): Result<T> {
    const code: AppErrorCode = classifyEngineError(error);
    if (code !== 'unknown') {
      return fail(code, String(error));
    }
    return fail(looksLikePdf(bytes) ? 'file-corrupted' : 'not-a-pdf', String(error));
  }

  private guard<T>(action: () => Result<T>): Result<T> {
    try {
      return action();
    } catch (error) {
      return fail(
        classifyEngineError(error),
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
