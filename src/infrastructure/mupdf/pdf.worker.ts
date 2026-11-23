/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import wasmUrl from '@mupdf-wasm?url';
import type { Result } from '../../application/errors';
import { fail, ok } from '../../application/errors';
import type { DocumentId, PageLink, SearchResult, TextLine } from '../../domain/document';
import { fetchWithProgress } from './fetchWithProgress';
import type { EngineOpenResult } from './MupdfEngine';
import { MupdfEngine } from './MupdfEngine';

let engine: MupdfEngine | null = null;

function withEngine<T>(action: (e: MupdfEngine) => Result<T>): Result<T> {
  return engine === null ? fail('engine-load-failed', 'Engine not loaded') : action(engine);
}

export interface RenderedBitmap {
  readonly width: number;
  readonly height: number;
  readonly bitmap: ImageBitmap;
}

const api = {
  async load(onProgress: (fraction: number) => void): Promise<Result<null>> {
    if (engine !== null) {
      onProgress(1);
      return ok(null);
    }
    try {
      const wasmBinary = await fetchWithProgress(wasmUrl, __MUPDF_WASM_BYTES__, onProgress);
      // mupdf.js reads its Emscripten module settings from this global before it initialises.
      globalThis.$libmupdf_wasm_Module = { wasmBinary };
      const mupdf = await import('mupdf');
      engine = new MupdfEngine(mupdf);
      return ok(null);
    } catch (error) {
      return fail('engine-load-failed', error instanceof Error ? error.message : String(error));
    }
  },

  open(bytes: Uint8Array, password?: string): Result<EngineOpenResult> {
    return withEngine((e) => e.open(bytes, password));
  },

  close(id: DocumentId): void {
    engine?.close(id);
  },

  async renderPage(
    id: DocumentId,
    pageIndex: number,
    scale: number,
  ): Promise<Result<RenderedBitmap>> {
    const raw = withEngine((e) => e.renderPage(id, pageIndex, scale));
    if (!raw.ok) {
      return raw;
    }
    const { width, height, pixels } = raw.value;
    const bitmap = await createImageBitmap(new ImageData(pixels, width, height));
    return Comlink.transfer(ok({ width, height, bitmap }), [bitmap]);
  },

  getTextLines(id: DocumentId, pageIndex: number): Result<TextLine[]> {
    return withEngine((e) => e.getTextLines(id, pageIndex));
  },

  getPageText(id: DocumentId, pageIndex: number): Result<string> {
    return withEngine((e) => e.getPageText(id, pageIndex));
  },

  search(id: DocumentId, query: string, maxHits: number): Result<SearchResult> {
    return withEngine((e) => e.search(id, query, maxHits));
  },

  getLinks(id: DocumentId, pageIndex: number): Result<PageLink[]> {
    return withEngine((e) => e.getLinks(id, pageIndex));
  },
};

export type PdfWorkerApi = typeof api;

Comlink.expose(api);
