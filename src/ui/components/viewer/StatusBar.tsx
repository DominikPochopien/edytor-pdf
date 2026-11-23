import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePageInput, zoomToPercent } from '../../../application/viewer';
import type { OpenedDocument } from '../../store/viewerStore';
import { useViewerStore } from '../../store/viewerStore';

export function StatusBar({ document }: { readonly document: OpenedDocument }) {
  const { t } = useTranslation();
  const currentPage = useViewerStore((s) => s.currentPage);
  const zoom = useViewerStore((s) => s.zoom);
  const goToPage = useViewerStore((s) => s.goToPage);
  const pageCount = document.info.pages.length;
  /** What the user is typing; null when the box simply shows the current page. */
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (): void => {
    if (draft !== null) {
      const index = parsePageInput(draft, pageCount);
      if (index !== null) {
        goToPage(index);
      }
    }
    setDraft(null);
  };

  return (
    <footer
      aria-label={t('status.label')}
      className="flex h-9 shrink-0 items-center gap-4 border-t border-neutral-200 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-800"
    >
      <label className="flex items-center gap-2">
        <span>{t('status.page')}</span>
        <input
          aria-label={t('status.goToPage')}
          inputMode="numeric"
          data-testid="page-input"
          value={draft ?? String(currentPage + 1)}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit();
              event.currentTarget.blur();
            }
          }}
          className="h-7 w-14 rounded border border-neutral-300 bg-white text-center tabular-nums dark:border-neutral-600 dark:bg-neutral-900"
        />
        <span data-testid="page-count">{t('status.of', { count: pageCount })}</span>
      </label>
      <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
        {t('status.zoom', { percent: zoomToPercent(zoom) })}
      </span>
      {document.info.wasRepaired && (
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
          <TriangleAlert aria-hidden className="size-4" />
          {t('status.repaired')}
        </span>
      )}
    </footer>
  );
}
