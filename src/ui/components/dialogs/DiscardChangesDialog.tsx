import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';
import { buttonStyles } from '../common/buttonStyles';
import { Modal } from '../common/Modal';

export function DiscardChangesDialog() {
  const { t } = useTranslation();
  const open = useEditorStore((s) => s.discardPrompt !== null);
  const answer = useEditorStore((s) => s.answerDiscard);

  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          answer(false);
        }
      }}
      title={t('discard.title')}
      description={t('discard.description')}
    >
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => {
            answer(false);
          }}
        >
          {t('discard.cancel')}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          onClick={() => {
            answer(true);
          }}
        >
          {t('discard.confirm')}
        </button>
      </div>
    </Modal>
  );
}
