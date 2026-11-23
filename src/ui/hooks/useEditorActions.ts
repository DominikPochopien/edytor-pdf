import { useMemo } from 'react';
import type { Command } from '../../application/commands';
import type { EditorTool } from '../../application/ports';
import type { PageLookup, StylePatch } from '../../application/use-cases';
import {
  copyObjects,
  createRectangle,
  duplicateSelection,
  nudgeObjects,
  removeSelection,
  reorderObject,
  reshapeObject,
  restyleObject,
  selectedObjects,
  transformObject,
} from '../../application/use-cases';
import type { DisplayFrame, ObjectId } from '../../domain/objects';
import { useServices } from '../app/services';
import { useEditorStore } from '../store/editorStore';
import { useViewerStore } from '../store/viewerStore';

export interface EditorActions {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly setTool: (tool: EditorTool) => void;
  readonly select: (ids: readonly ObjectId[]) => void;
  readonly draw: (tool: EditorTool, pageIndex: number, display: DisplayFrame) => void;
  readonly transform: (id: ObjectId, display: DisplayFrame, kind: 'move' | 'transform') => void;
  readonly nudge: (dx: number, dy: number) => void;
  readonly removeSelected: () => void;
  readonly duplicateSelected: () => void;
  readonly copySelected: () => void;
  readonly cutSelected: () => void;
  readonly paste: () => void;
  readonly arrange: (direction: 'front' | 'back') => void;
  readonly restyle: (id: ObjectId, patch: StylePatch) => void;
  readonly reshape: (id: ObjectId, change: (display: DisplayFrame) => DisplayFrame) => void;
}

const pageLookup: PageLookup = (pageIndex) =>
  useViewerStore.getState().document?.info.pages[pageIndex];

/**
 * Connects UI gestures to the application's editing use cases. Every change becomes a Command
 * executed by the EditorSession, so it can be undone.
 */
export function useEditorActions(): EditorActions {
  const { editor, newId } = useServices();

  return useMemo<EditorActions>(() => {
    const model = () => editor.snapshot.model;
    const selection = () => useEditorStore.getState().selection;
    const run = (command: Command | null): void => {
      if (command !== null) {
        editor.execute(command);
      }
    };

    return {
      undo: () => {
        editor.undo();
      },
      redo: () => {
        editor.redo();
      },
      setTool: (tool) => {
        useEditorStore.getState().setTool(tool);
      },
      select: (ids) => {
        useEditorStore.getState().select(ids);
      },
      draw: (_tool, pageIndex, display) => {
        const page = pageLookup(pageIndex);
        if (page === undefined) {
          return;
        }
        const command = createRectangle(page, display, newId);
        run(command);
        const created = editor.snapshot.model.objects.at(-1);
        const store = useEditorStore.getState();
        store.setTool('select');
        if (created !== undefined) {
          store.select([created.id]);
        }
      },
      transform: (id, display, kind) => {
        run(transformObject(model(), id, display, pageLookup, kind));
      },
      nudge: (dx, dy) => {
        run(nudgeObjects(model(), selection(), pageLookup, dx, dy, Date.now()));
      },
      removeSelected: () => {
        run(removeSelection(model(), selection()));
      },
      duplicateSelected: () => {
        const copy = duplicateSelection(model(), selection(), pageLookup, newId);
        if (copy !== null) {
          run(copy.command);
          useEditorStore.getState().select(copy.ids);
        }
      },
      copySelected: () => {
        useEditorStore.getState().setClipboard(selectedObjects(model(), selection()));
      },
      cutSelected: () => {
        useEditorStore.getState().setClipboard(selectedObjects(model(), selection()));
        run(removeSelection(model(), selection()));
      },
      paste: () => {
        const page = pageLookup(useViewerStore.getState().currentPage);
        const { clipboard } = useEditorStore.getState();
        if (page === undefined) {
          return;
        }
        const copy = copyObjects(clipboard, page, newId, 'paste');
        if (copy !== null) {
          run(copy.command);
          useEditorStore.getState().select(copy.ids);
          // The next paste is offset again from the pasted copies.
          useEditorStore.getState().setClipboard(selectedObjects(model(), copy.ids));
        }
      },
      arrange: (direction) => {
        const [id] = selection();
        if (id !== undefined) {
          run(reorderObject(model(), id, direction));
        }
      },
      restyle: (id, patch) => {
        run(restyleObject(model(), id, patch, Date.now()));
      },
      reshape: (id, change) => {
        run(reshapeObject(model(), id, pageLookup, change, Date.now()));
      },
    };
  }, [editor, newId]);
}
