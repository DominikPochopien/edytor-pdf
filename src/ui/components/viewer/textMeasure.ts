import type { FontFamilyKind } from '../../../domain/document';

/** Size at which text is measured; the result is scaled, so any size works. */
const MEASURE_FONT_SIZE = 100;

let context: CanvasRenderingContext2D | null = null;

/** Width of `text` in CSS pixels for a font size of 1px, using the browser's generic font. */
export function measureTextWidth(
  text: string,
  family: FontFamilyKind,
  bold: boolean,
  italic: boolean,
): number {
  context ??= document.createElement('canvas').getContext('2d');
  if (context === null) {
    return 0;
  }
  context.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${MEASURE_FONT_SIZE}px ${family}`;
  return context.measureText(text).width / MEASURE_FONT_SIZE;
}
