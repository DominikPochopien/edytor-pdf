import type { DocumentId } from '../../domain/document';
import type { FontKey } from '../../domain/fonts';
import type { EditObject, ObjectId } from '../../domain/objects';
import type { TextLayoutResult } from './TextLayout';

/** How one text box is written: its line breaks (as on screen) and the font file it uses. */
export interface TextExportInfo {
  readonly layout: TextLayoutResult;
  readonly font: FontKey;
}

/** What the PDF writer needs besides the objects: font files and the line breaks of text boxes. */
export interface ExportResources {
  readonly fonts: Readonly<Partial<Record<FontKey, Uint8Array>>>;
  readonly texts: Readonly<Record<ObjectId, TextExportInfo>>;
}

export const NO_EXPORT_RESOURCES: ExportResources = { fonts: {}, texts: {} };

export interface PdfDocumentWriter {
  /**
   * Builds the file to save: a fresh copy of the original document with the objects drawn into
   * the page content. The open document itself is never modified.
   */
  exportDocument(
    id: DocumentId,
    objects: readonly EditObject[],
    resources: ExportResources,
  ): Promise<Uint8Array>;
}
