import { useEffect } from 'react';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';
import { useViewerStore } from '../store/viewerStore';

/** Starts downloading the PDF engine as soon as the app shows, in parallel with the welcome screen. */
export function useEngineLoader(): void {
  const { engine, session, onEngineReset } = useServices();

  useEffect(() => {
    const store = useViewerStore.getState();
    engine
      .load((fraction) => {
        useViewerStore.getState().setEngineProgress(fraction);
      })
      .then(() => {
        useViewerStore.getState().setEngineStatus('ready');
      })
      .catch((error: unknown) => {
        logDev('Engine failed to load', error);
        store.setEngineStatus('error');
        store.showError('engine-load-failed');
      });
  }, [engine]);

  useEffect(
    () =>
      onEngineReset(() => {
        session.forget();
        useViewerStore.getState().setDocument(null);
      }),
    [onEngineReset, session],
  );
}
