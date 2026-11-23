import { useCallback } from 'react';
import { toAppError } from '../../application/errors';
import type { PickedFile } from '../../application/ports';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';
import { useViewerStore } from '../store/viewerStore';

const SAMPLE_FILE_NAME = 'przyklad-arkusz.pdf';

export interface DocumentActions {
  openFromPicker: () => Promise<void>;
  openFile: (file: File) => Promise<void>;
  openSample: () => Promise<void>;
  openRecent: (id: string) => Promise<boolean>;
  submitPassword: (password: string) => Promise<void>;
  cancelPassword: () => void;
  closeDocument: () => Promise<void>;
}

export function useDocumentActions(): DocumentActions {
  const services = useServices();

  const openPicked = useCallback(
    async (file: PickedFile, password?: string): Promise<void> => {
      const store = useViewerStore.getState();
      store.setOpening(true);
      store.showError(null);
      try {
        const outcome = await services.session.open(file, password);
        if (outcome.status === 'password-required') {
          store.setPendingPassword({ file, wrongPassword: outcome.wrongPassword });
          return;
        }
        store.setDocument({ info: outcome.document, fileName: file.name });
      } catch (error) {
        logDev('Cannot open document', error);
        store.setPendingPassword(null);
        store.showError(toAppError(error).code);
      } finally {
        useViewerStore.getState().setOpening(false);
      }
    },
    [services],
  );

  const run = useCallback(async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      logDev('File action failed', error);
      useViewerStore.getState().showError(toAppError(error).code);
    }
  }, []);

  const openFromPicker = useCallback(
    () =>
      run(async () => {
        const picked = await services.files.pickPdfFile();
        if (picked !== null) {
          await openPicked(picked);
        }
      }),
    [run, services, openPicked],
  );

  const openFile = useCallback(
    (file: File) =>
      run(async () => {
        await openPicked(await services.files.readFile(file));
      }),
    [run, services, openPicked],
  );

  const openSample = useCallback(
    () =>
      run(async () => {
        const response = await fetch(services.sampleUrl);
        if (!response.ok) {
          throw new Error(`Sample not available: HTTP ${response.status}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        await openPicked({ name: SAMPLE_FILE_NAME, bytes });
      }),
    [run, services, openPicked],
  );

  const openRecent = useCallback(
    async (id: string): Promise<boolean> => {
      let found = false;
      await run(async () => {
        const stored = await services.recentFiles.load(id);
        if (stored === null) {
          return;
        }
        found = true;
        await openPicked(stored);
      });
      return found;
    },
    [run, services, openPicked],
  );

  const submitPassword = useCallback(
    async (password: string) => {
      const pending = useViewerStore.getState().pendingPassword;
      if (pending !== null) {
        await openPicked(pending.file, password);
      }
    },
    [openPicked],
  );

  const cancelPassword = useCallback(() => {
    useViewerStore.getState().setPendingPassword(null);
  }, []);

  const closeDocument = useCallback(
    () =>
      run(async () => {
        await services.session.close();
        useViewerStore.getState().setDocument(null);
      }),
    [run, services],
  );

  return {
    openFromPicker,
    openFile,
    openSample,
    openRecent,
    submitPassword,
    cancelPassword,
    closeDocument,
  };
}
