import * as Tabs from '@radix-ui/react-tabs';
import { useTranslation } from 'react-i18next';
import type { OpenedDocument, SidebarTab } from '../../store/viewerStore';
import { useViewerStore } from '../../store/viewerStore';
import { SearchPanel } from './SearchPanel';
import { Thumbnails } from './Thumbnails';

const tabStyle =
  'flex-1 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 data-[state=active]:border-accent-600 data-[state=active]:text-accent-700 dark:text-neutral-300 dark:hover:text-white dark:data-[state=active]:text-accent-100';

function isSidebarTab(value: string): value is SidebarTab {
  return value === 'thumbnails' || value === 'search';
}

export function Sidebar({ document }: { readonly document: OpenedDocument }) {
  const { t } = useTranslation();
  const tab = useViewerStore((s) => s.sidebarTab);
  const openSidebar = useViewerStore((s) => s.openSidebar);

  return (
    <aside
      aria-label={t('sidebar.label')}
      className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          if (isSidebarTab(value)) {
            openSidebar(value);
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List className="flex shrink-0 border-b border-neutral-200 dark:border-neutral-700">
          <Tabs.Trigger value="thumbnails" className={tabStyle}>
            {t('sidebar.thumbnails')}
          </Tabs.Trigger>
          <Tabs.Trigger value="search" className={tabStyle}>
            {t('sidebar.search')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="thumbnails" className="min-h-0 flex-1">
          <Thumbnails document={document} />
        </Tabs.Content>
        <Tabs.Content value="search" className="min-h-0 flex-1">
          <SearchPanel />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
