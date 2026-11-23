import { MonitorSmartphone, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function UnsupportedBrowser({ missing }: { readonly missing: readonly string[] }) {
  const { t } = useTranslation();
  return (
    <main className="flex h-full items-center justify-center p-6">
      <div role="alert" className="max-w-lg rounded-xl bg-white p-8 shadow-lg dark:bg-neutral-800">
        <h1 className="text-xl font-semibold">{t('browser.unsupportedTitle')}</h1>
        <p className="mt-3 text-neutral-700 dark:text-neutral-200">
          {t('browser.unsupportedText', { features: missing.join(', ') })}
        </p>
      </div>
    </main>
  );
}

export function MobileNotice() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return null;
  }
  return (
    <div
      role="note"
      className="flex items-start gap-3 bg-amber-100 px-4 py-3 text-sm text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
    >
      <MonitorSmartphone aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p className="flex-1">{t('browser.mobileText')}</p>
      <button
        type="button"
        aria-label={t('browser.dismiss')}
        className="rounded p-1 hover:bg-amber-200 dark:hover:bg-amber-800"
        onClick={() => {
          setVisible(false);
        }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
