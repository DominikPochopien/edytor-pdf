export type FontFamilyId = string;
export type FontStyleKey = 'regular' | 'bold' | 'italic' | 'bold-italic';
/** Identifies one font file: family and style, e.g. "noto-sans:bold". */
export type FontKey = `${FontFamilyId}:${FontStyleKey}`;

export const FONT_STYLES: readonly FontStyleKey[] = ['regular', 'bold', 'italic', 'bold-italic'];

export function fontStyleKey(bold: boolean, italic: boolean): FontStyleKey {
  if (bold && italic) {
    return 'bold-italic';
  }
  if (bold) {
    return 'bold';
  }
  return italic ? 'italic' : 'regular';
}

export function fontKey(family: FontFamilyId, style: FontStyleKey): FontKey {
  return `${family}:${style}`;
}

export type FontCategory = 'sans-serif' | 'serif' | 'custom' | 'system';

export interface FontFamilyInfo {
  readonly id: FontFamilyId;
  /** Name shown to the user. */
  readonly name: string;
  readonly category: FontCategory;
  /** Styles that have their own font file. Missing ones cannot be used for bold/italic. */
  readonly styles: readonly FontStyleKey[];
}

/** The style actually used: falls back to regular when the family has no such file. */
export function availableStyle(
  family: FontFamilyInfo,
  bold: boolean,
  italic: boolean,
): FontStyleKey {
  const wanted = fontStyleKey(bold, italic);
  return family.styles.includes(wanted) ? wanted : 'regular';
}
