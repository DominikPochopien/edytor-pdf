import * as Comlink from 'comlink';
import type { Result } from '../../application/errors';
import { AppError } from '../../application/errors';
import type {
  EngineLoadProgress,
  OpenDocumentResult,
  PageBitmap,
  PdfDocumentLoader,
  PdfEngineLoader,
  PdfDocumentWriter,
  PdfRenderer,
  PdfTextExtractor,
  SearchOptions,
} from '../../application/ports';
import type { DocumentId, PageLink, SearchResult, TextLine } from '../../domain/document';
import type { EditObject } from '../../domain/objects';
import type { PdfWorkerApi } from './pdf.worker';

/** A broken or hostile file must not block the app forever. */
const OPEN_TIMEOUT_MS = 60_000;

function unwrap<T>(result: Result<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new AppError(result.code, result.detail);
}

function createWorker(): Worker {
  return new Worker(new URL('./pdf.worker.ts', import.meta.url), {
    type: 'module',
    name: 'pdf-engine',
  });
}

/**
 * Main-thread side of the PDF engine. All MuPDF work happens in a Web Worker, so the UI never
 * freezes. Implements the application ports used by the viewer.
 */
export class WorkerPdfEngine
  implements PdfEngineLoader, PdfDocumentLoader, PdfRenderer, PdfTextExtractor, PdfDocumentWriter
{
  private worker: Worker;
  private remote: Comlink.Remote<PdfWorkerApi>;
  private loading: Promise<void> | null = null;
  private progressListener: EngineLoadProgress = () => undefined;
  private readonly resetListeners = new Set<() => void>();

  constructor() {
    this.worker = createWorker();
    this.remote = Comlink.wrap<PdfWorkerApi>(this.worker);
  }

  /** Called when the engine had to be restarted; every open document is then gone. */
  onReset(listener: () => void): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  load(onProgress: EngineLoadProgress): Promise<void> {
    this.progressListener = onProgress;
    this.loading ??= this.startLoading().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  async open(bytes: Uint8Array, password?: string): Promise<OpenDocumentResult> {
    await this.load(this.progressListener);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutError = new AppError('file-corrupted', 'Opening timed out');
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(timeoutError);
      }, OPEN_TIMEOUT_MS);
    });
    try {
      return unwrap(await Promise.race([this.remote.open(bytes, password), timeout]));
    } catch (error) {
      if (error === timeoutError) {
        this.restart();
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async close(id: DocumentId): Promise<void> {
    await this.remote.close(id);
  }

  async renderPage(id: DocumentId, pageIndex: number, scale: number): Promise<PageBitmap> {
    const { width, height, bitmap } = unwrap(await this.remote.renderPage(id, pageIndex, scale));
    return {
      width,
      height,
      image: bitmap,
      dispose: () => {
        bitmap.close();
      },
    };
  }

  async getTextLines(id: DocumentId, pageIndex: number): Promise<readonly TextLine[]> {
    return unwrap(await this.remote.getTextLines(id, pageIndex));
  }

  async getPageText(id: DocumentId, pageIndex: number): Promise<string> {
    return unwrap(await this.remote.getPageText(id, pageIndex));
  }

  async search(id: DocumentId, query: string, options: SearchOptions): Promise<SearchResult> {
    return unwrap(await this.remote.search(id, query, options.maxHits));
  }

  async getLinks(id: DocumentId, pageIndex: number): Promise<readonly PageLink[]> {
    return unwrap(await this.remote.getLinks(id, pageIndex));
  }

  async exportDocument(id: DocumentId, objects: readonly EditObject[]): Promise<Uint8Array> {
    return unwrap(await this.remote.exportDocument(id, objects));
  }

  private async startLoading(): Promise<void> {
    const report = Comlink.proxy((fraction: number) => {
      this.progressListener(fraction);
    });
    unwrap(await this.remote.load(report));
  }

  private restart(): void {
    this.remote[Comlink.releaseProxy]();
    this.worker.terminate();
    this.worker = createWorker();
    this.remote = Comlink.wrap<PdfWorkerApi>(this.worker);
    this.loading = null;
    void this.load(this.progressListener);
    for (const listener of this.resetListeners) {
      listener();
    }
  }
}
