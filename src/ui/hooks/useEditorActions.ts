import { useMemo } from 'react';
import type { Command } from '../../application/commands';
import { toAppError } from '../../application/errors';
import type { DrawingTool, EditorTool } from '../../application/ports';
import type { PageLookup, StylePatch } from '../../application/use-cases';
import {
  copyObjects,
  createRectangle,
  createText,
  createWhiteout,
  duplicateSelection,
  editText,
  nudgeObjects,
  removeSelection,
  reorderObject,
  reshapeObject,
  restyleObject,
  restyleText,
  selectedObjects,
  textFontKey,
  transformObject,
} from '../../application/use-cases';
import type { DisplayFrame, HexColor, ObjectId, TextStyle } from '../../domain/objects';
import { findObject } from '../../domain/objects';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';
import { useEditorStore } from '../store/editorStore';
import { useViewerStore } from '../store/viewerStore';

export interface TextChange {
  readonly style?: Partial<TextStyle>;
  readonly width?: number;
}

export interface EditorActions {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly setTool: (tool: EditorTool) => void;
  readonly select: (ids: readonly ObjectId[]) => void;
  readonly draw: (tool: DrawingTool, pageIndex: number, display: DisplayFrame) => void;
  readonly transform: (id: ObjectId, display: DisplayFrame, kind: 'move' | 'transform') => void;
  readonly addText: (pageIndex: number, display: DisplayFrame, text: string) => void;
  readonly finishTextEdit: (id: ObjectId, text: string, display: DisplayFrame) => void;
  readonly changeText: (id: ObjectId, change: TextChange) => Promise<void>;
  readonly pickColor: (color: HexColor) => void;
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
  const { editor, newId, fonts, loadTextLayout } = useServices();

  return useMemo<EditorActions>(() => {
    const model = () => editor.snapshot.model;
    const selection = () => useEditorStore.getState().selection;
    const run = (command: Command | null): void => {
      if (command !== null) {
        editor.execute(command);
      }
    };
    /** Runs a command that creates one object, then selects it with the select tool. */
    const runAndSelectNew = (command: Command | null): void => {
      if (command === null) {
        return;
      }
      run(command);
      const created = editor.snapshot.model.objects.at(-1);
      const store = useEditorStore.getState();
      store.setTool('select');
      if (created !== undefined) {
        store.select([created.id]);
      }
    };
    const reportError = (error: unknown): void => {
      logDev('Editing failed', error);
      useViewerStore.getState().showError(toAppError(error).code);
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
        if (tool === 'text') {
          // Load the font before the first click, so the new box is measured correctly.
          const { style } = useEditorStore.getState().textDefaults;
          fonts.ensureLoaded([textFontKey(style, fonts)]).catch(reportError);
        }
      },
      select: (ids) => {
        useEditorStore.getState().select(ids);
      },
      draw: (tool, pageIndex, display) => {
        const page = pageLookup(pageIndex);
        if (page === undefined) {
          return;
        }
        runAndSelectNew(
          tool === 'whiteout'
            ? createWhiteout(page, display, newId)
            : createRectangle(page, display, newId),
        );
      },
      transform: (id, display, kind) => {
        run(transformObject(model(), id, display, pageLookup, kind));
      },
      addText: (pageIndex, display, text) => {
        const page = pageLookup(pageIndex);
        if (page !== undefined) {
          const { style } = useEditorStore.getState().textDefaults;
          runAndSelectNew(createText(page, display, text, style, newId));
        }
      },
      finishTextEdit: (id, text, display) => {
        run(editText(model(), id, text, display, pageLookup));
      },
      changeText: async (id, change) => {
        const object = findObject(model(), id);
        if (object?.kind !== 'text') {
          return;
        }
        try {
          const style = { ...object.style, ...change.style };
          await fonts.ensureLoaded([textFontKey(style, fonts)]);
          const layout = await loadTextLayout();
          run(restyleText(model(), id, pageLookup, layout, change, Date.now()));
          if (change.style !== undefined) {
            useEditorStore.getState().setTextDefaults(change.style);
          }
        } catch (error) {
          reportError(error);
        }
      },
      pickColor: (color) => {
        const store = useEditorStore.getState();
        const target = store.pickTarget;
        store.setTool('select');
        if (target !== null) {
          run(restyleObject(model(), target, { color }, Date.now()));
          store.select([target]);
        }
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
  }, [editor, newId, fonts, loadTextLayout]);
}
