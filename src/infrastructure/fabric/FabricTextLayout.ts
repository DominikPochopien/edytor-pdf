import { Textbox } from 'fabric';
import type { LayerFonts, TextLayoutEngine, TextLayoutResult } from '../../application/ports';
import type { TextStyle } from '../../domain/objects';
import { textboxOptions } from './textboxOptions';

/** Line breaking with Fabric.js itself, so the saved PDF wraps exactly like the screen. */
export class FabricTextLayout implements TextLayoutEngine {
  constructor(private readonly fonts: LayerFonts) {}

  layout(text: string, style: TextStyle, width: number): TextLayoutResult {
    const box = new Textbox(text, textboxOptions(style, width, this.fonts));
    const last = box.textLines.length - 1;
    const lines = box.textLines.map((line, index) => ({
      text: line,
      width: box.getLineWidth(index),
      endsParagraph: index === last || box.isEndOfWrapping(index),
    }));
    return { lines, height: box.height };
  }
}
