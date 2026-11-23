import { useCallback } from 'react';
import { toAppError } from '../../application/errors';
import type { PickedFile } from '../../application/ports';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';
import { useEditorStore } from '../store/editorStore';
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

  /** True when there is nothing to lose, or the user agreed to throw the changes away. */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!services.editor.snapshot.dirty) {
      return true;
    }
    return useEditorStore.getState().askDiscard();
  }, [services]);

  const openPicked = useCallback(
    async (file: PickedFile, password?: string): Promise<void> => {
      if (password === undefined && !(await confirmDiscard())) {
        return;
      }
      const store = useViewerStore.getState();
      store.setOpening(true);
      store.showError(null);
      try {
        const outcome = await services.session.open(file, password);
        if (outcome.status === 'password-required') {
          store.setPendingPassword({ file, wrongPassword: outcome.wrongPassword });
          return;
        }
        services.editor.reset();
        useEditorStore.getState().resetEditor();
        store.setDocument({ info: outcome.document, fileName: file.name, handle: file.handle });
      } catch (error) {
        logDev('Cannot open document', error);
        store.setPendingPassword(null);
        store.showError(toAppError(error).code);
      } finally {
        useViewerStore.getState().setOpening(false);
      }
    },
    [services, confirmDiscard],
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
        if (!(await confirmDiscard())) {
          return;
        }
        await services.session.close();
        services.editor.reset();
        useEditorStore.getState().resetEditor();
        useViewerStore.getState().setDocument(null);
      }),
    [run, services, confirmDiscard],
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
