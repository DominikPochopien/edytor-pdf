import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronDown,
  CircleHelp,
  FileText,
  Info,
  Keyboard,
  LoaderCircle,
  MousePointer2,
  PanelLeft,
  Redo2,
  Save,
  Search,
  Square,
  Undo2,
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
import { useEditorActions } from '../../hooks/useEditorActions';
import { useSaveActions } from '../../hooks/useSaveActions';
import { useEditorStore } from '../../store/editorStore';
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

function FileMenu() {
  const { t } = useTranslation();
  const { openFromPicker, closeDocument } = useDocumentActions();
  const { save, saveAs } = useSaveActions();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700">
        {t('toolbar.file')}
        <ChevronDown aria-hidden className="size-4 opacity-60" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuContent} sideOffset={4} align="start">
          <DropdownMenu.Item className={menuItem} onSelect={() => void openFromPicker()}>
            {t('toolbar.open')}
            <kbd className="ml-auto text-xs opacity-60">Ctrl+O</kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItem} onSelect={() => void save()}>
            {t('toolbar.save')}
            <kbd className="ml-auto text-xs opacity-60">Ctrl+S</kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItem} onSelect={() => void saveAs()}>
            {t('toolbar.saveAs')}
            <kbd className="ml-auto pl-4 text-xs opacity-60">Ctrl+Shift+S</kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          <DropdownMenu.Item className={menuItem} onSelect={() => void closeDocument()}>
            {t('toolbar.close')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function HistoryButtons() {
  const { t } = useTranslation();
  const { undo, redo } = useEditorActions();
  const { canUndo, canRedo, undoLabel, redoLabel } = useEditorStore((s) => s.snapshot);
  return (
    <>
      <IconButton
        label={
          undoLabel === null
            ? t('toolbar.undo')
            : t('toolbar.undoWhat', { what: t(`history.${undoLabel}`) })
        }
        shortcut="Ctrl+Z"
        icon={<Undo2 aria-hidden className="size-5" />}
        disabled={!canUndo}
        onClick={undo}
        data-testid="undo"
      />
      <IconButton
        label={
          redoLabel === null
            ? t('toolbar.redo')
            : t('toolbar.redoWhat', { what: t(`history.${redoLabel}`) })
        }
        shortcut="Ctrl+Y"
        icon={<Redo2 aria-hidden className="size-5" />}
        disabled={!canRedo}
        onClick={redo}
        data-testid="redo"
      />
    </>
  );
}

function ToolButtons() {
  const { t } = useTranslation();
  const tool = useEditorStore((s) => s.tool);
  const { setTool } = useEditorActions();
  return (
    <div role="group" aria-label={t('toolbar.tools')} className="flex items-center gap-1">
      <IconButton
        label={t('toolbar.toolSelect')}
        shortcut="V"
        icon={<MousePointer2 aria-hidden className="size-5" />}
        active={tool === 'select'}
        aria-pressed={tool === 'select'}
        onClick={() => {
          setTool('select');
        }}
      />
      <IconButton
        label={t('toolbar.toolRectangle')}
        shortcut="R"
        icon={<Square aria-hidden className="size-5" />}
        active={tool === 'rectangle'}
        aria-pressed={tool === 'rectangle'}
        onClick={() => {
          setTool('rectangle');
        }}
      />
    </div>
  );
}

const separator = <div aria-hidden className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />;

export function Toolbar() {
  const { t } = useTranslation();
  const { closeDocument } = useDocumentActions();
  const { save } = useSaveActions();
  const saving = useEditorStore((s) => s.saving);
  const dirty = useEditorStore((s) => s.snapshot.dirty);
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
      <FileMenu />
      <IconButton
        label={saving ? t('toolbar.saving') : t('toolbar.save')}
        shortcut="Ctrl+S"
        icon={
          saving ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
          ) : (
            <Save aria-hidden className="size-5" />
          )
        }
        disabled={saving}
        onClick={() => void save()}
      />
      <HistoryButtons />
      {separator}
      <ToolButtons />
      {separator}
      <div className="mx-2 flex min-w-0 items-center gap-2" title={fileName}>
        <FileText aria-hidden className="size-4 shrink-0 text-neutral-400" />
        <span className="max-w-56 truncate text-sm font-medium">
          {dirty && (
            <span
              aria-label={t('toolbar.unsaved')}
              title={t('toolbar.unsaved')}
              data-testid="dirty-marker"
            >
              *{' '}
            </span>
          )}
          <span data-testid="file-name">{fileName}</span>
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
