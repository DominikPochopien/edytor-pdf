import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchActions } from '../../hooks/useSearch';
import { useViewerStore } from '../../store/viewerStore';
import { IconButton } from '../common/IconButton';

function Highlighted({ text, query }: { readonly text: string; readonly query: string }) {
  const at = text.toLocaleLowerCase('pl').indexOf(query.trim().toLocaleLowerCase('pl'));
  if (at === -1 || query.trim() === '') {
    return <>{text}</>;
  }
  const end = at + query.trim().length;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-600/60">
        {text.slice(at, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

export function SearchPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useViewerStore((s) => s.search);
  const focusSequence = useViewerStore((s) => s.searchFocusSequence);
  const actions = useSearchActions();
  const hits = search.result?.hits ?? [];

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusSequence]);

  const status = (() => {
    if (search.query.trim() === '') {
      return '';
    }
    if (search.running) {
      return t('search.searching');
    }
    if (hits.length === 0) {
      return t('search.noResults');
    }
    return search.activeHit === null
      ? t('search.count', { count: hits.length })
      : t('search.position', { current: search.activeHit + 1, total: hits.length });
  })();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            ref={inputRef}
            type="search"
            aria-label={t('search.label')}
            placeholder={t('search.placeholder')}
            value={search.query}
            onChange={(event) => {
              actions.setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (event.shiftKey) {
                  actions.previous();
                } else {
                  actions.next();
                }
              }
              if (event.key === 'Escape') {
                actions.clear();
              }
            }}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white pr-2 pl-8 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <div className="mt-2 flex items-center gap-1">
          <p
            className="flex-1 text-xs text-neutral-600 dark:text-neutral-300"
            aria-live="polite"
            data-testid="search-status"
          >
            {status}
          </p>
          <IconButton
            label={t('search.previous')}
            shortcut="Shift+Enter"
            icon={<ChevronUp aria-hidden className="size-4" />}
            disabled={hits.length === 0}
            onClick={actions.previous}
          />
          <IconButton
            label={t('search.next')}
            shortcut="Enter"
            icon={<ChevronDown aria-hidden className="size-4" />}
            disabled={hits.length === 0}
            onClick={actions.next}
          />
          <IconButton
            label={t('search.clear')}
            icon={<X aria-hidden className="size-4" />}
            disabled={search.query === ''}
            onClick={actions.clear}
          />
        </div>
        {search.result?.truncated === true && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {t('search.truncated', { count: hits.length })}
          </p>
        )}
      </div>
      <ol className="flex-1 overflow-y-auto p-2" aria-label={t('sidebar.search')}>
        {hits.map((hit, index) => (
          // Hits have no identity beyond their position in the result list.
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <li key={index}>
            <button
              type="button"
              aria-current={index === search.activeHit ? 'true' : undefined}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 aria-[current=true]:bg-accent-100 dark:hover:bg-neutral-700 dark:aria-[current=true]:bg-accent-700/40"
              onClick={() => {
                const store = useViewerStore.getState();
                store.setSearch({ activeHit: index });
                store.goToPage(hit.pageIndex, hit.rects[0]?.y);
              }}
            >
              <span className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {t('search.page', { page: hit.pageIndex + 1 })}
              </span>
              <span className="block break-words">
                <Highlighted text={hit.context} query={search.query} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
