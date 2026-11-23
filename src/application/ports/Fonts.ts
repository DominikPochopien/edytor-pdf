import type {
  FontCategory,
  FontFamilyId,
  FontFamilyInfo,
  FontKey,
  FontStyleKey,
} from '../../domain/fonts';

export interface FontFace {
  readonly style: FontStyleKey;
  readonly bytes: Uint8Array;
}

/** Fonts available for new text: the bundled ones plus fonts the user added. */
export interface FontProvider {
  families(): readonly FontFamilyInfo[];
  family(id: FontFamilyId): FontFamilyInfo | undefined;
  /** CSS font-family name under which the browser knows this family. */
  cssFamily(id: FontFamilyId): string;
  /** Makes the browser load the font files (needed before text can be measured or shown). */
  ensureLoaded(keys: readonly FontKey[]): Promise<void>;
  /** The font file, to embed it in the saved PDF. */
  getBytes(key: FontKey): Promise<Uint8Array>;
  /** Adds a font family from files (own .ttf/.otf or a font installed in the system). */
  addFamily(
    name: string,
    faces: readonly FontFace[],
    category: Extract<FontCategory, 'custom' | 'system'>,
  ): Promise<FontFamilyInfo>;
  subscribe(listener: () => void): () => void;
}

export interface FontCheck {
  readonly valid: boolean;
  /** Polish letters that the font does not contain (empty when all are there). */
  readonly missingPolish: string;
}

/** Checks a font file with the PDF engine before it is used. */
export interface FontInspector {
  inspectFont(bytes: Uint8Array): Promise<FontCheck>;
}

export interface LocalFontFamily {
  readonly name: string;
  readonly styles: readonly FontStyleKey[];
}

/** Fonts installed on the computer (Local Font Access API, Chrome and Edge). */
export interface LocalFontSource {
  readonly supported: boolean;
  /** Asks the browser for permission and lists the families. */
  listFamilies(): Promise<readonly LocalFontFamily[]>;
  loadFamily(name: string): Promise<readonly FontFace[]>;
}
