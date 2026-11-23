import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';

/** Full-screen progress shown while a file opens (and, on the first visit, while the engine downloads). */
export function OpeningOverlay() {
  const { t } = useTranslation();
  const opening = useViewerStore((s) => s.opening);
  const engineStatus = useViewerStore((s) => s.engineStatus);
  const progress = useViewerStore((s) => s.engineProgress);
  if (!opening) {
    return null;
  }
  const waitingForEngine = engineStatus === 'loading';
  const percent = Math.round(progress * 100);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-neutral-100/80 backdrop-blur-sm dark:bg-neutral-900/80">
      <div
        className="w-80 rounded-xl bg-white p-6 text-center shadow-xl dark:bg-neutral-800"
        role="status"
      >
        <p className="font-semibold">
          {waitingForEngine ? t('engine.loadingTitle') : t('engine.openingFile')}
        </p>
        {waitingForEngine && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {t('engine.loadingHint')}
          </p>
        )}
        <div
          role="progressbar"
          aria-label={waitingForEngine ? t('engine.loadingTitle') : t('engine.openingFile')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={waitingForEngine ? percent : undefined}
          className="mt-4 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700"
        >
          {waitingForEngine ? (
            <div
              className="h-full bg-accent-500 transition-[width]"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div className="h-full w-2/5 animate-[progress-indeterminate_1.2s_ease-in-out_infinite] bg-accent-500" />
          )}
        </div>
      </div>
    </div>
  );
}
