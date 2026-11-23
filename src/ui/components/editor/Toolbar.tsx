import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronDown,
  CircleHelp,
  FileText,
  FolderOpen,
  Keyboard,
  Info,
  PanelLeft,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  nextZoomStep,
  previousZoomStep,
  ZOOM_PRESETS,
  zoomToPercent,
} from '../../../application/viewer';
import { useDocumentActions } from '../../hooks/useDocumentActions';
import { useViewerStore } from '../../store/viewerStore';
import { IconButton } from '../common/IconButton';

const menuItem =
  'flex cursor-default items-center gap-2 rounded px-3 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-accent-100 data-[highlighted]:text-accent-700 dark:data-[highlighted]:bg-accent-700/40 dark:data-[highlighted]:text-white';
const menuContent =
  'z-50 min-w-48 rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800';

function ZoomMenu() {
  const { t } = useTranslation();
  const zoom = useViewerStore((s) => s.zoom);
  const setZoom = useViewerStore((s) => s.setZoom);
  const setZoomMode = useViewerStore((s) => s.setZoomMode);
  const percent = zoomToPercent(zoom);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('toolbar.zoomMenu', { percent })}
        className="inline-flex h-9 w-24 items-center justify-between rounded-md border border-neutral-300 px-2 text-sm tabular-nums hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
      >
        <span data-testid="zoom-value">{percent}%</span>
        <ChevronDown aria-hidden className="size-4 opacity-60" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuContent} sideOffset={4}>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              setZoomMode('fit-width');
            }}
          >
            {t('toolbar.fitWidth')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              setZoomMode('fit-page');
            }}
          >
            {t('toolbar.fitPage')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenu.Item
              key={preset}
              className={menuItem}
              onSelect={() => {
                setZoom(preset);
              }}
            >
              {zoomToPercent(preset)}%
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function HelpMenu() {
  const { t } = useTranslation();
  const openDialog = useViewerStore((s) => s.openDialog);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('toolbar.help')}
        className="inline-flex size-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <CircleHelp aria-hidden className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuContent} sideOffset={4} align="end">
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              openDialog('shortcuts');
            }}
          >
            <Keyboard aria-hidden className="size-4" />
            {t('toolbar.shortcuts')}
            <kbd className="ml-auto text-xs opacity-60">?</kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              openDialog('about');
            }}
          >
            <Info aria-hidden className="size-4" />
            {t('toolbar.about')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function Toolbar() {
  const { t } = useTranslation();
  const { openFromPicker, closeDocument } = useDocumentActions();
  const fileName = useViewerStore((s) => s.document?.fileName ?? '');
  const zoom = useViewerStore((s) => s.zoom);
  const setZoom = useViewerStore((s) => s.setZoom);
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const toggleSidebar = useViewerStore((s) => s.toggleSidebar);
  const focusSearch = useViewerStore((s) => s.focusSearch);

  return (
    <header
      role="toolbar"
      aria-label={t('toolbar.label')}
      className="flex h-12 shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <IconButton
        label={t('toolbar.toggleSidebar')}
        icon={<PanelLeft aria-hidden className="size-5" />}
        active={sidebarOpen}
        aria-pressed={sidebarOpen}
        onClick={toggleSidebar}
      />
      <IconButton
        label={t('toolbar.open')}
        shortcut="Ctrl+O"
        icon={<FolderOpen aria-hidden className="size-5" />}
        onClick={() => void openFromPicker()}
      />
      <div className="mx-2 flex min-w-0 items-center gap-2" title={fileName}>
        <FileText aria-hidden className="size-4 shrink-0 text-neutral-400" />
        <span className="max-w-72 truncate text-sm font-medium" data-testid="file-name">
          {fileName}
        </span>
      </div>

      <div className="mx-auto flex items-center gap-1">
        <IconButton
          label={t('toolbar.zoomOut')}
          shortcut="Ctrl+−"
          icon={<ZoomOut aria-hidden className="size-5" />}
          onClick={() => {
            setZoom(previousZoomStep(zoom));
          }}
        />
        <ZoomMenu />
        <IconButton
          label={t('toolbar.zoomIn')}
          shortcut="Ctrl++"
          icon={<ZoomIn aria-hidden className="size-5" />}
          onClick={() => {
            setZoom(nextZoomStep(zoom));
          }}
        />
      </div>

      <IconButton
        label={t('toolbar.search')}
        shortcut="Ctrl+F"
        icon={<Search aria-hidden className="size-5" />}
        onClick={focusSearch}
      />
      <HelpMenu />
      <IconButton
        label={t('toolbar.close')}
        icon={<X aria-hidden className="size-5" />}
        onClick={() => void closeDocument()}
      />
    </header>
  );
}
