import type {
  FontFace as FontFile,
  LocalFontFamily,
  LocalFontSource,
} from '../../application/ports';
import type { FontStyleKey } from '../../domain/fonts';

interface LocalFontData {
  readonly family: string;
  readonly style: string;
  blob: () => Promise<Blob>;
}

interface LocalFontWindow {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
}

/** Maps a font's style name ("Bold Italic", "Regular"…) to our style key; other weights are skipped. */
export function styleFromName(style: string): FontStyleKey | null {
  const name = style.toLowerCase().replace(/[-_]/g, ' ').trim();
  const italic = /italic|oblique|kursywa/.test(name);
  const bold = /bold|pogrubiony/.test(name) && !/semi|demi|extra|ultra/.test(name);
  const plain = name === '' || /regular|normal|book|roman|standard/.test(name) || name === 'italic';
  if (bold && italic) {
    return 'bold-italic';
  }
  if (bold) {
    return 'bold';
  }
  if (!plain && !italic) {
    return null;
  }
  return italic ? 'italic' : 'regular';
}

/** Fonts installed on the computer, through the Local Font Access API (Chrome, Edge). */
export class BrowserLocalFonts implements LocalFontSource {
  private fonts: LocalFontData[] | null = null;

  get supported(): boolean {
    return typeof (window as unknown as LocalFontWindow).queryLocalFonts === 'function';
  }

  async listFamilies(): Promise<readonly LocalFontFamily[]> {
    const fonts = await this.query();
    const families = new Map<string, Set<FontStyleKey>>();
    for (const font of fonts) {
      const style = styleFromName(font.style);
      if (style !== null) {
        const styles = families.get(font.family) ?? new Set<FontStyleKey>();
        styles.add(style);
        families.set(font.family, styles);
      }
    }
    return [...families.entries()]
      .filter(([, styles]) => styles.has('regular'))
      .map(([name, styles]) => ({ name, styles: [...styles] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }

  async loadFamily(name: string): Promise<readonly FontFile[]> {
    const fonts = (await this.query()).filter((f) => f.family === name);
    const faces = new Map<FontStyleKey, FontFile>();
    for (const font of fonts) {
      const style = styleFromName(font.style);
      if (style !== null && !faces.has(style)) {
        faces.set(style, { style, bytes: new Uint8Array(await (await font.blob()).arrayBuffer()) });
      }
    }
    return [...faces.values()];
  }

  private async query(): Promise<LocalFontData[]> {
    const query = (window as unknown as LocalFontWindow).queryLocalFonts;
    if (query === undefined) {
      return [];
    }
    this.fonts ??= await query();
    return this.fonts;
  }
}
