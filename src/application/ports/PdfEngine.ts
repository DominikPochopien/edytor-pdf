import type {
  DocumentId,
  DocumentInfo,
  PageLink,
  SearchResult,
  TextLine,
} from '../../domain/document';

export type EngineLoadProgress = (loadedFraction: number) => void;

/** Starts the PDF engine. Loading can take a few seconds on the first visit. */
export interface PdfEngineLoader {
  load(onProgress: EngineLoadProgress): Promise<void>;
}

export type OpenDocumentResult =
  | { readonly status: 'opened'; readonly document: DocumentInfo }
  | { readonly status: 'password-required'; readonly wrongPassword: boolean };

export interface PdfDocumentLoader {
  /**
   * Opens a PDF. The bytes are copied into the engine; the caller keeps its own copy.
   * Resolves with `password-required` when the file is encrypted and no password, or a wrong one,
   * was given. Rejects with an AppError when the file cannot be opened.
   */
  open(bytes: Uint8Array, password?: string): Promise<OpenDocumentResult>;
  close(id: DocumentId): Promise<void>;
}

/** A rendered page bitmap. The caller must call `dispose` when it is no longer displayed. */
export interface PageBitmap {
  readonly width: number;
  readonly height: number;
  readonly image: CanvasImageSource;
  dispose(): void;
}

export interface PdfRenderer {
  /** Renders a page at `scale` device pixels per point (zoom × devicePixelRatio). */
  renderPage(id: DocumentId, pageIndex: number, scale: number): Promise<PageBitmap>;
}

export interface SearchOptions {
  readonly maxHits: number;
}

export interface PdfTextExtractor {
  getTextLines(id: DocumentId, pageIndex: number): Promise<readonly TextLine[]>;
  getPageText(id: DocumentId, pageIndex: number): Promise<string>;
  search(id: DocumentId, query: string, options: SearchOptions): Promise<SearchResult>;
  getLinks(id: DocumentId, pageIndex: number): Promise<readonly PageLink[]>;
}
