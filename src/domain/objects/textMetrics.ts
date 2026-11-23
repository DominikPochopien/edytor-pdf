import type { TextAlign } from './types';

/**
 * Vertical text metrics shared by the editing layer and the PDF writer, so that text lands on
 * the same baselines on screen and in the saved file. The values follow Fabric.js: a line box is
 * `fontSize × LINE_BOX_FACTOR` high and the baseline sits BASELINE_FRACTION above its bottom.
 */
export const LINE_BOX_FACTOR = 1.13;
export const BASELINE_FRACTION = 0.222;
/** Underline position below the baseline and its thickness, as a fraction of the font size. */
export const UNDERLINE_OFFSET = 0.1;
export const UNDERLINE_THICKNESS = 0.066667;

/** Distance between consecutive baselines. `lineHeight` is the user's line spacing (e.g. 1.2). */
export function lineAdvance(fontSize: number, lineHeight: number): number {
  return fontSize * LINE_BOX_FACTOR * lineHeight;
}

/** Height of a text block with `lineCount` lines (the last line has no extra spacing). */
export function textBlockHeight(fontSize: number, lineHeight: number, lineCount: number): number {
  const lines = Math.max(1, lineCount);
  return (lines - 1) * lineAdvance(fontSize, lineHeight) + fontSize * LINE_BOX_FACTOR;
}

/** Baseline of line `index`, measured from the top of the text block. */
export function baselineOffset(fontSize: number, lineHeight: number, index: number): number {
  return (
    index * lineAdvance(fontSize, lineHeight) + fontSize * LINE_BOX_FACTOR * (1 - BASELINE_FRACTION)
  );
}

/** Horizontal start of a line inside a box of `boxWidth` (justified lines start at 0). */
export function lineStart(align: TextAlign, boxWidth: number, lineWidth: number): number {
  switch (align) {
    case 'center':
      return (boxWidth - lineWidth) / 2;
    case 'right':
      return boxWidth - lineWidth;
    case 'left':
    case 'justify':
      return 0;
  }
}
