import { useEffect } from 'react';
import { nextZoomStep, previousZoomStep } from '../../application/viewer';
import { useViewerStore } from '../store/viewerStore';
import { useDocumentActions } from './useDocumentActions';
import { useSearchActions } from './useSearch';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Application shortcuts. Ctrl+O and Ctrl+F are taken over from the browser while the focus is
 * in the app. Ctrl+S and Ctrl+P arrive with saving and printing (stages 2 and 10).
 */
export function useKeyboardShortcuts(): void {
  const { openFromPicker } = useDocumentActions();
  const search = useSearchActions();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const store = useViewerStore.getState();
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const hasDocument = store.document !== null;

      if (ctrl && key === 'o') {
        event.preventDefault();
        void openFromPicker();
        return;
      }
      if (ctrl && key === 'f' && hasDocument) {
        event.preventDefault();
        store.focusSearch();
        return;
      }
      if (ctrl && (key === '=' || key === '+') && hasDocument) {
        event.preventDefault();
        store.setZoom(nextZoomStep(store.zoom));
        return;
      }
      if (ctrl && key === '-' && hasDocument) {
        event.preventDefault();
        store.setZoom(previousZoomStep(store.zoom));
        return;
      }
      if (ctrl && key === '0' && hasDocument) {
        event.preventDefault();
        store.setZoom(1);
        return;
      }
      if (key === 'f3' && hasDocument) {
        event.preventDefault();
        if (event.shiftKey) {
          search.previous();
        } else {
          search.next();
        }
        return;
      }
      if (event.key === '?' && !ctrl && !isTyping(event.target)) {
        event.preventDefault();
        store.openDialog('shortcuts');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openFromPicker, search]);
}
