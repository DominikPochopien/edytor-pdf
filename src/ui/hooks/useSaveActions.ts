import { useCallback } from 'react';
import { toAppError } from '../../application/errors';
import { prepareExportResources } from '../../application/use-cases';
import type { SaveOutcome } from '../../application/ports';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';
import { useEditorStore } from '../store/editorStore';
import { useViewerStore } from '../store/viewerStore';

export interface SaveActions {
  /** "Zapisz": overwrites the opened file when the browser allows it, otherwise like "Zapisz jako". */
  readonly save: () => Promise<boolean>;
  /** "Zapisz jako": always a new file. */
  readonly saveAs: () => Promise<boolean>;
}

export function useSaveActions(): SaveActions {
  const { writer, saver, editor, fonts, loadTextLayout } = useServices();

  const run = useCallback(
    async (inPlace: boolean): Promise<boolean> => {
      const { document } = useViewerStore.getState();
      const editorStore = useEditorStore.getState();
      if (document === null || editorStore.saving) {
        return false;
      }
      editorStore.setSaving(true);
      editorStore.showSaveNotice(null);
      try {
        const { objects } = editor.snapshot.model;
        const resources = await prepareExportResources(objects, fonts, loadTextLayout);
        const bytes = await writer.exportDocument(document.info.id, objects, resources);
        let outcome: SaveOutcome | null = null;
        if (inPlace && document.handle !== undefined && saver.canSaveInPlace) {
          outcome = await saver.saveToHandle(document.handle, bytes, document.fileName);
        }
        outcome ??= await saver.saveAs(bytes, document.fileName);
        if (outcome === null) {
          return false;
        }
        editor.markSaved();
        if (outcome.method === 'file') {
          useViewerStore.getState().renameDocument(outcome.name, outcome.handle);
        }
        useEditorStore.getState().showSaveNotice({
          kind: outcome.method === 'file' ? 'saved' : 'downloaded',
          name: outcome.name,
        });
        return true;
      } catch (error) {
        logDev('Save failed', error);
        const { code } = toAppError(error);
        useViewerStore.getState().showError(code === 'unknown' ? 'save-failed' : code);
        return false;
      } finally {
        useEditorStore.getState().setSaving(false);
      }
    },
    [writer, saver, editor, fonts, loadTextLayout],
  );

  const save = useCallback(() => run(true), [run]);
  const saveAs = useCallback(() => run(false), [run]);
  return { save, saveAs };
}
