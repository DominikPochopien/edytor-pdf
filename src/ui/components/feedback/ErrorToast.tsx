import { CircleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';

/** Errors are shown as plain Polish sentences; technical details stay in the dev console. */
export function ErrorToast() {
  const { t } = useTranslation();
  const error = useViewerStore((s) => s.error);
  const showError = useViewerStore((s) => s.showError);
  if (error === null) {
    return null;
  }
  return (
    <div
      role="alert"
      data-testid="error-message"
      className="fixed bottom-6 left-1/2 z-50 flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border border-red-200 bg-white p-4 shadow-2xl dark:border-red-800 dark:bg-neutral-800"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-red-600" />
      <div className="flex-1">
        <p className="font-semibold">{t('errors.title')}</p>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">
          {t(`errors.${error}`)}
        </p>
      </div>
      <button
        type="button"
        aria-label={t('errors.dismiss')}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        onClick={() => {
          showError(null);
        }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
