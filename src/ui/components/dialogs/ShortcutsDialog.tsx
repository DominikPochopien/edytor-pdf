import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';
import { buttonStyles } from '../common/buttonStyles';
import { Modal } from '../common/Modal';

const SHORTCUTS = [
  ['Ctrl+O', 'shortcuts.open'],
  ['Ctrl+F', 'shortcuts.find'],
  ['Enter / F3', 'shortcuts.nextHit'],
  ['Shift+Enter / Shift+F3', 'shortcuts.previousHit'],
  ['Ctrl++', 'shortcuts.zoomIn'],
  ['Ctrl+−', 'shortcuts.zoomOut'],
  ['Ctrl+0', 'shortcuts.zoomReset'],
  ['Ctrl + kółko myszy', 'shortcuts.zoomWheel'],
  ['?', 'shortcuts.help'],
] as const;

export function ShortcutsDialog() {
  const { t } = useTranslation();
  const open = useViewerStore((s) => s.dialog === 'shortcuts');
  const openDialog = useViewerStore((s) => s.openDialog);

  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        openDialog(value ? 'shortcuts' : null);
      }}
      title={t('shortcuts.title')}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={keys} className="contents">
            <dt>
              <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 font-sans text-xs dark:border-neutral-600 dark:bg-neutral-900">
                {keys}
              </kbd>
            </dt>
            <dd>{t(label)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => {
            openDialog(null);
          }}
        >
          {t('shortcuts.close')}
        </button>
      </div>
    </Modal>
  );
}
