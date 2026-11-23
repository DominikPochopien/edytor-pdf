import { FileClock, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecentFileEntry } from '../../../application/ports';
import { BYTES_PER_KIB, BYTES_PER_MIB } from '../../../domain/units';
import { logDev } from '../../app/devLog';
import { useServices } from '../../app/services';
import { useDocumentActions } from '../../hooks/useDocumentActions';

function formatSize(bytes: number): string {
  return bytes >= BYTES_PER_MIB
    ? `${(bytes / BYTES_PER_MIB).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / BYTES_PER_KIB))} KB`;
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });

export function RecentFiles() {
  const { t } = useTranslation();
  const { recentFiles } = useServices();
  const { openRecent } = useDocumentActions();
  const [entries, setEntries] = useState<readonly RecentFileEntry[]>([]);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(() => {
    recentFiles.list().then(setEntries, (error: unknown) => {
      logDev('Cannot list recent files', error);
    });
  }, [recentFiles]);

  useEffect(refresh, [refresh]);

  if (entries.length === 0) {
    return null;
  }

  const open = async (entry: RecentFileEntry): Promise<void> => {
    const found = await openRecent(entry.id);
    setMissing(!found);
    if (!found) {
      await recentFiles.remove(entry.id);
      refresh();
    }
  };

  return (
    <section className="mt-8" aria-labelledby="recent-title">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-title" className="text-base font-semibold">
          {t('welcome.recentTitle')}
        </h2>
        <button
          type="button"
          className="text-sm text-neutral-500 underline hover:text-accent-600"
          onClick={() => {
            void recentFiles.clear().then(refresh);
          }}
        >
          {t('welcome.recentClear')}
        </button>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('welcome.recentHint')}</p>
      {missing && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {t('welcome.recentMissing')}
        </p>
      )}
      <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center">
            <button
              type="button"
              aria-label={t('welcome.recentOpen', { name: entry.name })}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700"
              onClick={() => void open(entry)}
            >
              <FileClock aria-hidden className="size-5 shrink-0 text-neutral-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{entry.name}</span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {formatSize(entry.size)} ·{' '}
                  {t('welcome.openedAt', { date: dateFormat.format(entry.openedAt) })}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label={t('welcome.recentRemove', { name: entry.name })}
              className="mr-2 rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
              onClick={() => {
                void recentFiles.remove(entry.id).then(refresh);
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
