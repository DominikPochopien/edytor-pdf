import { FileUp, Monitor } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toAppError } from '../../../application/errors';
import type { FontFamilyId } from '../../../domain/fonts';
import { logDev } from '../../app/devLog';
import { useServices } from '../../app/services';
import { useFontActions, useFontFamilies } from '../../hooks/useFonts';
import { useViewerStore } from '../../store/viewerStore';
import { SystemFontsDialog } from './SystemFontsDialog';
import { actionButton } from './sections';

interface FontPickerProps {
  readonly value: FontFamilyId;
  readonly onChange: (family: FontFamilyId) => void;
}

/** Font list (bundled and user fonts) with buttons to add a font file or a system font. */
export function FontPicker({ value, onChange }: FontPickerProps) {
  const { t } = useTranslation();
  const { localFonts } = useServices();
  const families = useFontFamilies();
  const { addFromFile } = useFontActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const bundled = families.filter((f) => f.category === 'serif' || f.category === 'sans-serif');
  const own = families.filter((f) => f.category === 'custom' || f.category === 'system');

  const report = (name: string, missingPolish: string): void => {
    setMessage(
      missingPolish === ''
        ? t('fonts.added', { name })
        : t('fonts.missingPolish', { name, letters: missingPolish }),
    );
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-neutral-600 dark:text-neutral-300" htmlFor="font-family">
        {t('properties.font')}
      </label>
      <select
        id="font-family"
        data-testid="prop-font"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
      >
        <optgroup label={t('properties.fontsBundled')}>
          {bundled.map((family) => (
            <option key={family.id} value={family.id}>
              {family.name}
            </option>
          ))}
        </optgroup>
        {own.length > 0 && (
          <optgroup label={t('properties.fontsCustom')}>
            {own.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={actionButton}
          onClick={() => {
            fileRef.current?.click();
          }}
        >
          <FileUp aria-hidden className="size-4" />
          {t('properties.addFontFile')}
        </button>
        {localFonts.supported && (
          <button
            type="button"
            className={actionButton}
            onClick={() => {
              setSystemOpen(true);
            }}
          >
            <Monitor aria-hidden className="size-4" />
            {t('properties.addSystemFont')}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        className="hidden"
        data-testid="font-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file === undefined) {
            return;
          }
          addFromFile(file).then(
            ({ family, missingPolish }) => {
              onChange(family.id);
              report(family.name, missingPolish);
            },
            (error: unknown) => {
              logDev('Cannot add font', error);
              useViewerStore
                .getState()
                .showError(toAppError(error).code === 'font-invalid' ? 'font-invalid' : 'unknown');
            },
          );
        }}
      />
      {message !== null && (
        <p
          role="status"
          className="text-xs text-neutral-700 dark:text-neutral-200"
          data-testid="font-message"
        >
          {message}
        </p>
      )}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('fonts.checkLicense')}</p>
      <SystemFontsDialog
        open={systemOpen}
        onClose={() => {
          setSystemOpen(false);
        }}
        onAdded={(family, missingPolish) => {
          onChange(family.id);
          report(family.name, missingPolish);
        }}
      />
    </div>
  );
}
