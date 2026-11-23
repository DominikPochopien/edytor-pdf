import type { DocumentInfo } from '../../domain/document';
import type { PdfDocumentLoader, PickedFile, RecentFilesStore } from '../ports';
import type { PageImageService } from '../viewer';

export type OpenOutcome =
  | { readonly status: 'opened'; readonly document: DocumentInfo }
  | { readonly status: 'password-required'; readonly wrongPassword: boolean };

export interface DocumentSessionDeps {
  readonly loader: PdfDocumentLoader;
  readonly recentFiles: RecentFilesStore;
  readonly images: PageImageService;
  readonly onWarning?: (message: string, error: unknown) => void;
}

/**
 * The document currently being viewed. Opening a new file replaces the previous one only after
 * the new one opened successfully, so a failed attempt never loses the user's work.
 */
export class DocumentSession {
  private current: DocumentInfo | null = null;

  constructor(private readonly deps: DocumentSessionDeps) {}

  get document(): DocumentInfo | null {
    return this.current;
  }

  async open(file: PickedFile, password?: string): Promise<OpenOutcome> {
    const result = await this.deps.loader.open(file.bytes, password);
    if (result.status === 'password-required') {
      return result;
    }
    await this.close();
    this.current = result.document;
    this.deps.recentFiles.remember(file.name, file.bytes, file.handle).catch((error: unknown) => {
      // Remembering is a convenience; private browsing modes may block IndexedDB.
      this.deps.onWarning?.('Cannot remember recent file', error);
    });
    return result;
  }

  async close(): Promise<void> {
    const previous = this.current;
    if (previous === null) {
      return;
    }
    this.current = null;
    this.deps.images.forgetDocument(previous.id);
    await this.deps.loader.close(previous.id);
  }

  /** Called when the engine restarted and every open document is gone. */
  forget(): void {
    if (this.current !== null) {
      this.deps.images.forgetDocument(this.current.id);
    }
    this.current = null;
  }
}
