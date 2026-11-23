import { useEffect } from 'react';
import { useServices } from '../app/services';
import { useEditorStore } from '../store/editorStore';

/** Mirrors the application's EditorSession (model + Undo/Redo state) into the UI store. */
export function useEditorSync(): void {
  const { editor } = useServices();
  useEffect(() => {
    const store = useEditorStore.getState();
    store.setSnapshot(editor.snapshot);
    return editor.subscribe((snapshot) => {
      useEditorStore.getState().setSnapshot(snapshot);
    });
  }, [editor]);
}
