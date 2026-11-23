import type { DocumentId } from '../../domain/document';
import type { EditObject } from '../../domain/objects';

export interface PdfDocumentWriter {
  /**
   * Builds the file to save: a fresh copy of the original document with the objects drawn into
   * the page content. The open document itself is never modified.
   */
  exportDocument(id: DocumentId, objects: readonly EditObject[]): Promise<Uint8Array>;
}
