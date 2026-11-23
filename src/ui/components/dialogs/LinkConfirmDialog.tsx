import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { checkExternalLink } from '../../../domain/document';
import { useViewerStore } from '../../store/viewerStore';
import { buttonStyles } from '../common/buttonStyles';
import { Modal } from '../common/Modal';

/** Links from a PDF open only after the user has seen the full address. */
export function LinkConfirmDialog() {
  const { t } = useTranslation();
  const uri = useViewerStore((s) => s.pendingLink);
  const confirmLink = useViewerStore((s) => s.confirmLink);
  const check = uri === null ? null : checkExternalLink(uri);
  const close = (): void => {
    confirmLink(null);
  };

  return (
    <Modal
      open={uri !== null}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      title={t('link.openTitle')}
      description={check?.safe === true ? t('link.openDescription') : t('link.blocked')}
    >
      <p
        data-testid="link-address"
        className="rounded-md bg-neutral-100 p-3 font-mono text-sm break-all dark:bg-neutral-900"
      >
        {uri}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={buttonStyles.secondary} onClick={close}>
          {t('link.cancel')}
        </button>
        {check?.safe === true && (
          <button
            type="button"
            className={buttonStyles.primary}
            onClick={() => {
              window.open(check.url, '_blank', 'noopener,noreferrer');
              close();
            }}
          >
            <ExternalLink aria-hidden className="size-4" />
            {t('link.open')}
          </button>
        )}
      </div>
    </Modal>
  );
}
