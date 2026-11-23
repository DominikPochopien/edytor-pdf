import { useCallback, useSyncExternalStore } from 'react';
import { AppError } from '../../application/errors';
import type { FontFamilyInfo } from '../../domain/fonts';
import { useServices } from '../app/services';

const FONT_FILE_EXTENSION = /\.(ttf|otf)$/i;

export interface FontAdded {
  readonly family: FontFamilyInfo;
  /** Polish letters the font does not have (empty when it is complete). */
  readonly missingPolish: string;
}

/** All font families, updated when the user adds one. */
export function useFontFamilies(): readonly FontFamilyInfo[] {
  const { fonts } = useServices();
  const subscribe = useCallback((listener: () => void) => fonts.subscribe(listener), [fonts]);
  const snapshot = useCallback(() => familiesSnapshot(fonts.families()), [fonts]);
  return useSyncExternalStore(subscribe, snapshot);
}

let lastFamilies: readonly FontFamilyInfo[] = [];
/** Returns the same array instance while the list is unchanged (required by useSyncExternalStore). */
function familiesSnapshot(families: readonly FontFamilyInfo[]): readonly FontFamilyInfo[] {
  const same =
    families.length === lastFamilies.length && families.every((f, i) => f === lastFamilies[i]);
  if (!same) {
    lastFamilies = families;
  }
  return lastFamilies;
}

export interface FontActions {
  readonly addFromFile: (file: File) => Promise<FontAdded>;
  readonly addSystemFamily: (name: string) => Promise<FontAdded>;
}

export function useFontActions(): FontActions {
  const { fonts, fontInspector, localFonts } = useServices();

  const addFromFile = useCallback(
    async (file: File): Promise<FontAdded> => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = await fontInspector.inspectFont(bytes);
      if (!check.valid) {
        throw new AppError('font-invalid', file.name);
      }
      const name = file.name.replace(FONT_FILE_EXTENSION, '');
      const family = await fonts.addFamily(name, [{ style: 'regular', bytes }], 'custom');
      return { family, missingPolish: check.missingPolish };
    },
    [fonts, fontInspector],
  );

  const addSystemFamily = useCallback(
    async (name: string): Promise<FontAdded> => {
      const faces = await localFonts.loadFamily(name);
      const regular = faces.find((f) => f.style === 'regular') ?? faces[0];
      if (regular === undefined) {
        throw new AppError('font-invalid', name);
      }
      const check = await fontInspector.inspectFont(regular.bytes);
      if (!check.valid) {
        throw new AppError('font-invalid', name);
      }
      const family = await fonts.addFamily(name, faces, 'system');
      return { family, missingPolish: check.missingPolish };
    },
    [fonts, fontInspector, localFonts],
  );

  return { addFromFile, addSystemFamily };
}
