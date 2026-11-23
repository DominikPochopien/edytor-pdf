import type { FontFace as FontFile, FontProvider } from '../../application/ports';
import type {
  FontCategory,
  FontFamilyId,
  FontFamilyInfo,
  FontKey,
  FontStyleKey,
} from '../../domain/fonts';
import { fontKey } from '../../domain/fonts';
import type { BundledFamily } from './catalog';
import { BUNDLED_FAMILIES, BUNDLED_STYLES } from './catalog';

const CSS_PREFIX = 'EdytorPdf-';
const BOLD_WEIGHT = '700';
const NORMAL_WEIGHT = '400';

type Source =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array };

function parseKey(key: FontKey): { family: FontFamilyId; style: FontStyleKey } {
  const separator = key.lastIndexOf(':');
  return { family: key.slice(0, separator), style: key.slice(separator + 1) as FontStyleKey };
}

function descriptors(style: FontStyleKey): FontFaceDescriptors {
  return {
    weight: style === 'bold' || style === 'bold-italic' ? BOLD_WEIGHT : NORMAL_WEIGHT,
    style: style === 'italic' || style === 'bold-italic' ? 'italic' : 'normal',
  };
}

/**
 * Fonts for the editor: bundled families (loaded from the app's own files, on demand) and
 * families the user added. Registers them with the browser (FontFace API) for display.
 */
export class BrowserFontProvider implements FontProvider {
  private readonly infos = new Map<FontFamilyId, FontFamilyInfo>();
  private readonly sources = new Map<FontKey, Source>();
  private readonly loading = new Map<FontKey, Promise<void>>();
  private readonly bytes = new Map<FontKey, Promise<Uint8Array>>();
  private readonly listeners = new Set<() => void>();
  private customCount = 0;

  constructor(
    baseUrl: string,
    private readonly fontSet: FontFaceSet | undefined = typeof document === 'undefined'
      ? undefined
      : document.fonts,
  ) {
    for (const family of BUNDLED_FAMILIES) {
      this.registerBundled(baseUrl, family);
    }
  }

  families(): readonly FontFamilyInfo[] {
    return [...this.infos.values()];
  }

  family(id: FontFamilyId): FontFamilyInfo | undefined {
    return this.infos.get(id);
  }

  cssFamily(id: FontFamilyId): string {
    return `${CSS_PREFIX}${id}`;
  }

  ensureLoaded(keys: readonly FontKey[]): Promise<void> {
    return Promise.all(keys.map((key) => this.load(key))).then(() => undefined);
  }

  getBytes(key: FontKey): Promise<Uint8Array> {
    let pending = this.bytes.get(key);
    if (pending === undefined) {
      const source = this.sources.get(key);
      pending =
        source === undefined
          ? Promise.reject(new Error(`Unknown font ${key}`))
          : source.kind === 'bytes'
            ? Promise.resolve(source.bytes)
            : fetch(source.url).then(async (response) => {
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status} for ${source.url}`);
                }
                return new Uint8Array(await response.arrayBuffer());
              });
      this.bytes.set(key, pending);
      pending.catch(() => this.bytes.delete(key));
    }
    return pending;
  }

  async addFamily(
    name: string,
    faces: readonly FontFile[],
    category: Extract<FontCategory, 'custom' | 'system'>,
  ): Promise<FontFamilyInfo> {
    const id = `${category}-${++this.customCount}`;
    for (const face of faces) {
      this.sources.set(fontKey(id, face.style), { kind: 'bytes', bytes: face.bytes });
    }
    const info: FontFamilyInfo = { id, name, category, styles: faces.map((f) => f.style) };
    this.infos.set(id, info);
    await this.ensureLoaded(info.styles.map((style) => fontKey(id, style)));
    this.notify();
    return info;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private registerBundled(baseUrl: string, family: BundledFamily): void {
    this.infos.set(family.id, {
      id: family.id,
      name: family.name,
      category: family.category,
      styles: BUNDLED_STYLES,
    });
    for (const style of BUNDLED_STYLES) {
      this.sources.set(fontKey(family.id, style), {
        kind: 'url',
        url: `${baseUrl}fonts/${family.file}-${style}.${family.extension}`,
      });
    }
  }

  private load(key: FontKey): Promise<void> {
    let pending = this.loading.get(key);
    if (pending === undefined) {
      pending = this.createFace(key);
      this.loading.set(key, pending);
      pending.catch(() => this.loading.delete(key));
    }
    return pending;
  }

  private async createFace(key: FontKey): Promise<void> {
    const source = this.sources.get(key);
    if (source === undefined || this.fontSet === undefined) {
      return;
    }
    const { family, style } = parseKey(key);
    const data = source.kind === 'url' ? `url("${source.url}")` : source.bytes.slice().buffer;
    const face = new FontFace(this.cssFamily(family), data, descriptors(style));
    await face.load();
    this.fontSet.add(face);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
