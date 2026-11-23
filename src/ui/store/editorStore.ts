import { create } from 'zustand';
import type { EditorSnapshot } from '../../application/commands';
import type { EditorTool } from '../../application/ports';
import type { EditObject, ObjectId } from '../../domain/objects';
import { EMPTY_MODEL } from '../../domain/objects';

export interface SaveNotice {
  readonly kind: 'saved' | 'downloaded';
  readonly name: string;
}

interface EditorState {
  readonly snapshot: EditorSnapshot;
  readonly selection: readonly ObjectId[];
  readonly tool: EditorTool;
  readonly clipboard: readonly EditObject[];
  readonly saving: boolean;
  readonly saveNotice: SaveNotice | null;
  readonly discardPrompt: ((discard: boolean) => void) | null;
}

interface EditorActions {
  setSnapshot: (snapshot: EditorSnapshot) => void;
  select: (ids: readonly ObjectId[]) => void;
  setTool: (tool: EditorTool) => void;
  setClipboard: (objects: readonly EditObject[]) => void;
  setSaving: (saving: boolean) => void;
  showSaveNotice: (notice: SaveNotice | null) => void;
  /** Asks the user whether unsaved changes may be thrown away. */
  askDiscard: () => Promise<boolean>;
  answerDiscard: (discard: boolean) => void;
  resetEditor: () => void;
}

const EMPTY_SNAPSHOT: EditorSnapshot = {
  model: EMPTY_MODEL,
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  dirty: false,
};

export const useEditorStore = create<EditorState & EditorActions>()((set, get) => ({
  snapshot: EMPTY_SNAPSHOT,
  selection: [],
  tool: 'select',
  clipboard: [],
  saving: false,
  saveNotice: null,
  discardPrompt: null,

  setSnapshot: (snapshot) => {
    const existing = new Set(snapshot.model.objects.map((o) => o.id));
    const selection = get().selection.filter((id) => existing.has(id));
    set({
      snapshot,
      selection: selection.length === get().selection.length ? get().selection : selection,
    });
  },
  select: (ids) => {
    const current = get().selection;
    if (current.length !== ids.length || current.some((id, i) => id !== ids[i])) {
      set({ selection: ids });
    }
  },
  setTool: (tool) => {
    set({ tool, selection: tool === 'select' ? get().selection : [] });
  },
  setClipboard: (clipboard) => {
    set({ clipboard });
  },
  setSaving: (saving) => {
    set({ saving });
  },
  showSaveNotice: (saveNotice) => {
    set({ saveNotice });
  },
  askDiscard: () =>
    new Promise<boolean>((resolve) => {
      set({ discardPrompt: resolve });
    }),
  answerDiscard: (discard) => {
    get().discardPrompt?.(discard);
    set({ discardPrompt: null });
  },
  resetEditor: () => {
    set({ selection: [], tool: 'select', saving: false, saveNotice: null });
  },
}));
