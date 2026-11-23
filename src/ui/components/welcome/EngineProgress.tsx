import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';

/** Small progress line shown while the engine downloads in the background. */
export function EngineProgress() {
  const { t } = useTranslation();
  const status = useViewerStore((s) => s.engineStatus);
  const progress = useViewerStore((s) => s.engineProgress);
  const percent = Math.round(progress * 100);

  if (status === 'error') {
    return null;
  }
  if (status === 'ready') {
    return <p data-testid="engine-ready">{t('engine.ready')}</p>;
  }
  return (
    <div>
      <p>{t('engine.loading', { percent })}</p>
      <div
        role="progressbar"
        aria-label={t('engine.loadingTitle')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-1 h-1 w-48 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700"
      >
        <div className="h-full bg-accent-500 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
