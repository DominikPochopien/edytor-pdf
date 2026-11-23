import type { TextStyle } from '../../domain/objects';

export interface LaidOutLine {
  readonly text: string;
  /** Width of the line as shown on screen, in points. */
  readonly width: number;
  /** True for the last line of a paragraph (not stretched when the text is justified). */
  readonly endsParagraph: boolean;
}

export interface TextLayoutResult {
  readonly lines: readonly LaidOutLine[];
  readonly height: number;
}

/**
 * Breaks text into lines exactly as the editing layer shows it, so the saved PDF wraps the
 * same way as the screen. The fonts used must already be loaded (FontProvider.ensureLoaded).
 */
export interface TextLayoutEngine {
  layout(text: string, style: TextStyle, width: number): TextLayoutResult;
}
