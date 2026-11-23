import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';
import { buttonStyles } from '../common/buttonStyles';
import { Modal } from '../common/Modal';

const THIRD_PARTY_LICENSES_FILE = 'THIRD_PARTY_LICENSES.txt';

export function AboutDialog() {
  const { t } = useTranslation();
  const open = useViewerStore((s) => s.dialog === 'about');
  const openDialog = useViewerStore((s) => s.openDialog);

  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        openDialog(value ? 'about' : null);
      }}
      title={t('about.title')}
      description={t('about.description')}
      wide
    >
      <p className="text-sm">{t('app.version', { version: __APP_VERSION__ })}</p>
      <p className="mt-2 text-sm">{t('about.licenseText')}</p>
      <ul className="mt-4 space-y-1 text-sm">
        <li>
          <a
            className="text-accent-700 underline dark:text-accent-100"
            href={__SOURCE_URL__}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('app.sourceCode')}
          </a>
        </li>
        <li>
          <a
            className="text-accent-700 underline dark:text-accent-100"
            href={`${import.meta.env.BASE_URL}${THIRD_PARTY_LICENSES_FILE}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('about.thirdParty')}
          </a>
        </li>
      </ul>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => {
            openDialog(null);
          }}
        >
          {t('about.close')}
        </button>
      </div>
    </Modal>
  );
}
