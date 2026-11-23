import { CircleCheck, X } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';

const NOTICE_TIMEOUT_MS = 5000;

/** Short confirmation after saving, so the user knows where the file went. */
export function SaveNotice() {
  const { t } = useTranslation();
  const notice = useEditorStore((s) => s.saveNotice);
  const show = useEditorStore((s) => s.showSaveNotice);

  useEffect(() => {
    if (notice === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      show(null);
    }, NOTICE_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice, show]);

  if (notice === null) {
    return null;
  }
  return (
    <div
      role="status"
      data-testid="save-notice"
      className="fixed right-6 bottom-12 z-40 flex max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-xl dark:border-emerald-800 dark:bg-neutral-800"
    >
      <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-600" />
      <p className="flex-1 text-sm">
        {notice.kind === 'saved'
          ? t('save.saved', { name: notice.name })
          : t('save.downloaded', { name: notice.name })}
      </p>
      <button
        type="button"
        aria-label={t('save.dismiss')}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        onClick={() => {
          show(null);
        }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
