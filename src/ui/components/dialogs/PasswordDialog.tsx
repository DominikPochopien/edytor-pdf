import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentActions } from '../../hooks/useDocumentActions';
import { useViewerStore } from '../../store/viewerStore';
import { buttonStyles } from '../common/buttonStyles';
import { Modal } from '../common/Modal';

export function PasswordDialog() {
  const { t } = useTranslation();
  const pending = useViewerStore((s) => s.pendingPassword);
  const opening = useViewerStore((s) => s.opening);
  const { submitPassword, cancelPassword } = useDocumentActions();
  const [password, setPassword] = useState('');

  return (
    <Modal
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPassword('');
          cancelPassword();
        }
      }}
      title={t('password.title')}
      description={t('password.description', { name: pending?.file.name ?? '' })}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitPassword(password).then(() => {
            setPassword('');
          });
        }}
      >
        <label className="block text-sm font-medium" htmlFor="pdf-password">
          {t('password.label')}
        </label>
        <input
          id="pdf-password"
          type="password"
          autoComplete="off"
          autoFocus
          value={password}
          aria-invalid={pending?.wrongPassword === true}
          aria-describedby={pending?.wrongPassword === true ? 'pdf-password-error' : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          className="mt-1 h-10 w-full rounded-md border border-neutral-300 px-3 dark:border-neutral-600 dark:bg-neutral-900"
        />
        {pending?.wrongPassword === true && (
          <p
            id="pdf-password-error"
            role="alert"
            className="mt-2 text-sm text-red-700 dark:text-red-300"
          >
            {t('password.wrong')}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={cancelPassword}>
            {t('password.cancel')}
          </button>
          <button
            type="submit"
            className={buttonStyles.primary}
            disabled={opening || password === ''}
          >
            {t('password.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
