import type { TextboxProps } from 'fabric';
import type { LayerFonts } from '../../application/ports';
import { availableStyle } from '../../domain/fonts';
import type { TextAlign, TextStyle } from '../../domain/objects';

const FABRIC_ALIGN: Record<TextAlign, TextboxProps['textAlign']> = {
  left: 'left',
  center: 'center',
  right: 'right',
  // Fabric's "justify" also stretches the last line of a paragraph; "justify-left" does not.
  justify: 'justify-left',
};

const FALLBACK_FONT = 'sans-serif';

/**
 * Text properties shared by the visible text boxes and the layout used for saving, so both
 * break lines in exactly the same places.
 */
export function textboxOptions(style: TextStyle, width: number, fonts: LayerFonts) {
  const family = fonts.family(style.fontFamily);
  const used = family === undefined ? 'regular' : availableStyle(family, style.bold, style.italic);
  return {
    width,
    fontFamily: family === undefined ? FALLBACK_FONT : fonts.cssFamily(style.fontFamily),
    fontSize: style.fontSize,
    fontWeight: used === 'bold' || used === 'bold-italic' ? 'bold' : 'normal',
    fontStyle: used === 'italic' || used === 'bold-italic' ? 'italic' : 'normal',
    underline: style.underline,
    textAlign: FABRIC_ALIGN[style.align],
    lineHeight: style.lineHeight,
    fill: style.color,
    splitByGrapheme: false,
  } as const;
}
