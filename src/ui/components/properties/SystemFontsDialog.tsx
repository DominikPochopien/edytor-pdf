import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalFontFamily } from '../../../application/ports';
import type { FontFamilyInfo } from '../../../domain/fonts';
import { logDev } from '../../app/devLog';
import { useServices } from '../../app/services';
import { useFontActions } from '../../hooks/useFonts';
import { buttonStyles } from '../common/buttonStyles';
import { Modal } from '../common/Modal';

interface SystemFontsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onAdded: (family: FontFamilyInfo, missingPolish: string) => void;
}

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly families: readonly LocalFontFamily[] }
  | { readonly status: 'denied' };

/** Lets the user pick a font installed on the computer (Local Font Access API). */
export function SystemFontsDialog({ open, onClose, onAdded }: SystemFontsDialogProps) {
  const { t } = useTranslation();
  const { localFonts } = useServices();
  const { addSystemFamily } = useFontActions();
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let current = true;
    localFonts.listFamilies().then(
      (families) => {
        if (current) {
          setState({ status: 'ready', families });
        }
      },
      (error: unknown) => {
        logDev('Local fonts unavailable', error);
        if (current) {
          setState({ status: 'denied' });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [open, localFonts]);

  const needle = query.trim().toLocaleLowerCase('pl');
  const visible =
    state.status === 'ready'
      ? state.families.filter((f) => f.name.toLocaleLowerCase('pl').includes(needle))
      : [];

  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose();
        }
      }}
      title={t('fonts.systemTitle')}
      description={t('fonts.systemDescription')}
      wide
    >
      <input
        type="search"
        aria-label={t('fonts.systemSearch')}
        placeholder={t('fonts.systemSearch')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        className="h-9 w-full rounded-md border border-neutral-300 px-3 text-sm dark:border-neutral-600 dark:bg-neutral-900"
      />
      <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700">
        {state.status === 'loading' && <p className="p-3 text-sm">{t('fonts.systemLoading')}</p>}
        {state.status === 'denied' && <p className="p-3 text-sm">{t('fonts.systemDenied')}</p>}
        {state.status === 'ready' && visible.length === 0 && (
          <p className="p-3 text-sm">{t('fonts.systemEmpty')}</p>
        )}
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {visible.map((family) => (
            <li
              key={family.name}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="truncate">{family.name}</span>
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={() => {
                  addSystemFamily(family.name).then(
                    ({ family: added, missingPolish }) => {
                      onAdded(added, missingPolish);
                      onClose();
                    },
                    (error: unknown) => {
                      logDev('Cannot add system font', error);
                      setState({ status: 'denied' });
                    },
                  );
                }}
              >
                {t('fonts.systemUse')}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className={buttonStyles.secondary} onClick={onClose}>
          {t('fonts.close')}
        </button>
      </div>
    </Modal>
  );
}
