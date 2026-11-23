import { useEffect } from 'react';
import type { EditorTool } from '../../application/ports';
import { NUDGE_STEP, NUDGE_STEP_LARGE } from '../../application/use-cases';
import { nextZoomStep, previousZoomStep } from '../../application/viewer';
import { useEditorStore } from '../store/editorStore';
import { useViewerStore } from '../store/viewerStore';
import { useDocumentActions } from './useDocumentActions';
import { useEditorActions } from './useEditorActions';
import { useSaveActions } from './useSaveActions';
import { useSearchActions } from './useSearch';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** True when focus is in a dialog or menu, where keys belong to that control. */
function inOverlay(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[role="dialog"],[role="menu"]') !== null;
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type Handler = (event: KeyboardEvent) => boolean;

/**
 * Application shortcuts. Ctrl+O, Ctrl+S and Ctrl+F are taken over from the browser while the
 * focus is in the app. Editing keys (Delete, arrows, Ctrl+C…) are ignored while typing in a field.
 */
export function useKeyboardShortcuts(): void {
  const { openFromPicker } = useDocumentActions();
  const search = useSearchActions();
  const editing = useEditorActions();
  const { save, saveAs } = useSaveActions();

  useEffect(() => {
    const documentShortcuts: Handler = (event) => {
      const store = useViewerStore.getState();
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (ctrl && key === 'o') {
        void openFromPicker();
        return true;
      }
      if (store.document === null) {
        return false;
      }
      if (ctrl && key === 's') {
        void (event.shiftKey ? saveAs() : save());
        return true;
      }
      if (ctrl && key === 'f') {
        store.focusSearch();
        return true;
      }
      if (ctrl && (key === '=' || key === '+')) {
        store.setZoom(nextZoomStep(store.zoom));
        return true;
      }
      if (ctrl && key === '-') {
        store.setZoom(previousZoomStep(store.zoom));
        return true;
      }
      if (ctrl && key === '0') {
        store.setZoom(1);
        return true;
      }
      if (key === 'f3') {
        if (event.shiftKey) {
          search.previous();
        } else {
          search.next();
        }
        return true;
      }
      return false;
    };

    const editShortcuts: Handler = (event) => {
      if (
        useViewerStore.getState().document === null ||
        isTyping(event.target) ||
        inOverlay(event.target)
      ) {
        return false;
      }
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const hasSelection = useEditorStore.getState().selection.length > 0;
      if (ctrl && key === 'z') {
        if (event.shiftKey) {
          editing.redo();
        } else {
          editing.undo();
        }
        return true;
      }
      if (ctrl && key === 'y') {
        editing.redo();
        return true;
      }
      if (ctrl && key === 'c' && hasSelection) {
        editing.copySelected();
        return true;
      }
      if (ctrl && key === 'x' && hasSelection) {
        editing.cutSelected();
        return true;
      }
      if (ctrl && key === 'v' && useEditorStore.getState().clipboard.length > 0) {
        editing.paste();
        return true;
      }
      if (ctrl && key === 'd' && hasSelection) {
        editing.duplicateSelected();
        return true;
      }
      if (ctrl && (key === ']' || key === '[') && hasSelection) {
        editing.arrange(key === ']' ? 'front' : 'back');
        return true;
      }
      if ((key === 'delete' || key === 'backspace') && hasSelection) {
        editing.removeSelected();
        return true;
      }
      const arrow = ARROWS[event.key];
      if (arrow !== undefined && hasSelection && !ctrl) {
        const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
        editing.nudge(arrow[0] * step, arrow[1] * step);
        return true;
      }
      if (key === 'escape') {
        editing.setTool('select');
        editing.select([]);
        return false;
      }
      if (!ctrl && !event.altKey && key === 'v') {
        editing.setTool('select');
        return true;
      }
      const toolKeys: Record<string, EditorTool> = { r: 'rectangle', t: 'text', w: 'whiteout' };
      const toolForKey = toolKeys[key];
      if (!ctrl && !event.altKey && toolForKey !== undefined) {
        editing.setTool(toolForKey);
        return true;
      }
      return false;
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (documentShortcuts(event) || editShortcuts(event)) {
        event.preventDefault();
        return;
      }
      if (event.key === '?' && !event.ctrlKey && !isTyping(event.target)) {
        event.preventDefault();
        useViewerStore.getState().openDialog('shortcuts');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openFromPicker, search, editing, save, saveAs]);
}
