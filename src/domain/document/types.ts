import type { PageRotation, Rect } from '../geometry';

/** Identifier of a document opened in the PDF engine. */
export type DocumentId = string;

export interface PageInfo {
  readonly index: number;
  /** Visible page area in PDF space (points). */
  readonly cropBox: Rect;
  readonly rotation: PageRotation;
}

export interface DocumentMetadata {
  readonly title: string;
  readonly author: string;
}

export interface DocumentInfo {
  readonly id: DocumentId;
  readonly pages: readonly PageInfo[];
  readonly metadata: DocumentMetadata;
  readonly isEncrypted: boolean;
  /** True when the engine had to repair a damaged file while opening it. */
  readonly wasRepaired: boolean;
}

export type FontFamilyKind = 'serif' | 'sans-serif' | 'monospace';

/** One line of text on a page, in display space (points, Y down, rotation applied). */
export interface TextLine {
  readonly text: string;
  readonly bbox: Rect;
  readonly fontSize: number;
  readonly fontFamily: FontFamilyKind;
  readonly bold: boolean;
  readonly italic: boolean;
  /** True for vertical or rotated text that cannot be laid out horizontally. */
  readonly vertical: boolean;
}

export interface SearchHit {
  readonly pageIndex: number;
  /** Highlight rectangles in display space. One hit can span several lines. */
  readonly rects: readonly Rect[];
  /** Text around the match, for the results list. */
  readonly context: string;
}

export interface SearchResult {
  readonly hits: readonly SearchHit[];
  /** True when the search stopped at the hit limit. */
  readonly truncated: boolean;
}

export type LinkTarget =
  | { readonly kind: 'external'; readonly uri: string }
  | { readonly kind: 'page'; readonly pageIndex: number };

export interface PageLink {
  /** Link area in display space. */
  readonly bbox: Rect;
  readonly target: LinkTarget;
}
