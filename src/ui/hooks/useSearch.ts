import { useCallback, useEffect, useRef } from 'react';
import { toAppError } from '../../application/errors';
import { firstHitFromPage, nextHitIndex, previousHitIndex } from '../../application/viewer';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';
import { useViewerStore } from '../store/viewerStore';

const SEARCH_DEBOUNCE_MS = 250;
export const MAX_SEARCH_HITS = 1000;

export interface SearchActions {
  setQuery: (query: string) => void;
  next: () => void;
  previous: () => void;
  clear: () => void;
}

function showHit(index: number | null): void {
  const store = useViewerStore.getState();
  const hit = index === null ? undefined : store.search.result?.hits[index];
  store.setSearch({ activeHit: index });
  if (hit !== undefined) {
    store.goToPage(hit.pageIndex, hit.rects[0]?.y);
  }
}

/** Runs the search when the query changes (debounced). Mount once, in the editor layout. */
export function useSearchRunner(): void {
  const { text } = useServices();
  const documentId = useViewerStore((s) => s.document?.info.id);
  const query = useViewerStore((s) => s.search.query);
  const requestRef = useRef(0);

  useEffect(() => {
    const store = useViewerStore.getState();
    const requestId = ++requestRef.current;
    if (documentId === undefined || query.trim() === '') {
      store.setSearch({ result: null, activeHit: null, running: false });
      return undefined;
    }
    store.setSearch({ running: true });
    const timer = setTimeout(() => {
      text.search(documentId, query, { maxHits: MAX_SEARCH_HITS }).then(
        (result) => {
          if (requestId !== requestRef.current) {
            return;
          }
          const current = useViewerStore.getState();
          current.setSearch({ result, running: false, activeHit: null });
          showHit(
            firstHitFromPage(
              result.hits.map((h) => h.pageIndex),
              current.currentPage,
            ),
          );
        },
        (error: unknown) => {
          if (requestId === requestRef.current) {
            logDev('Search failed', error);
            const current = useViewerStore.getState();
            current.setSearch({ running: false });
            current.showError(toAppError(error).code);
          }
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, documentId, query]);
}

/** Search actions: type a query, move between hits (Enter / Shift+Enter, F3). */
export function useSearchActions(): SearchActions {
  const setQuery = useCallback((value: string) => {
    useViewerStore.getState().setSearch({ query: value });
  }, []);

  const next = useCallback(() => {
    const { search } = useViewerStore.getState();
    showHit(nextHitIndex(search.activeHit, search.result?.hits.length ?? 0));
  }, []);

  const previous = useCallback(() => {
    const { search } = useViewerStore.getState();
    showHit(previousHitIndex(search.activeHit, search.result?.hits.length ?? 0));
  }, []);

  const clear = useCallback(() => {
    useViewerStore.getState().setSearch({ query: '', result: null, activeHit: null });
  }, []);

  return { setQuery, next, previous, clear };
}
