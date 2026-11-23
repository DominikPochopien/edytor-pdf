import type { FontCategory, FontFamilyId } from '../../domain/fonts';
import { FONT_STYLES } from '../../domain/fonts';

export interface BundledFamily {
  readonly id: FontFamilyId;
  readonly name: string;
  readonly category: FontCategory;
  /** Path under public/fonts without the "-<style>.<ext>" suffix. */
  readonly file: string;
  readonly extension: 'ttf' | 'otf';
}

/** Free fonts shipped with the app; all of them contain Polish letters (checked in tests). */
export const BUNDLED_FAMILIES: readonly BundledFamily[] = [
  {
    id: 'noto-sans',
    name: 'Noto Sans',
    category: 'sans-serif',
    file: 'noto-sans/NotoSans',
    extension: 'ttf',
  },
  {
    id: 'noto-serif',
    name: 'Noto Serif',
    category: 'serif',
    file: 'noto-serif/NotoSerif',
    extension: 'ttf',
  },
  { id: 'roboto', name: 'Roboto', category: 'sans-serif', file: 'roboto/Roboto', extension: 'ttf' },
  { id: 'lato', name: 'Lato', category: 'sans-serif', file: 'lato/Lato', extension: 'ttf' },
  {
    id: 'open-sans',
    name: 'Open Sans',
    category: 'sans-serif',
    file: 'open-sans/OpenSans',
    extension: 'ttf',
  },
  {
    id: 'latin-modern',
    name: 'Latin Modern Roman (LaTeX)',
    category: 'serif',
    file: 'latin-modern/LatinModernRoman',
    extension: 'otf',
  },
];

export const BUNDLED_STYLES = FONT_STYLES;
