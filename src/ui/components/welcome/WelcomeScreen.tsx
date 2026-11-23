import { FileText, FolderOpen, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentActions } from '../../hooks/useDocumentActions';
import { buttonStyles } from '../common/buttonStyles';
import { EngineProgress } from './EngineProgress';
import { RecentFiles } from './RecentFiles';

interface WelcomeScreenProps {
  readonly dragging: boolean;
}

export function WelcomeScreen({ dragging }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const { openFromPicker, openSample } = useDocumentActions();

  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <header className="flex items-center gap-3">
          <FileText aria-hidden className="size-8 text-accent-600" />
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
        </header>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t('app.tagline')}</p>

        <section
          aria-label={t('welcome.open')}
          data-dragging={dragging}
          className="mt-8 flex flex-col items-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white px-6 py-12 text-center transition-colors data-[dragging=true]:border-accent-500 data-[dragging=true]:bg-accent-50 dark:border-neutral-600 dark:bg-neutral-800 dark:data-[dragging=true]:bg-accent-700/20"
        >
          <button
            type="button"
            onClick={() => void openFromPicker()}
            className="inline-flex items-center gap-3 rounded-xl bg-accent-600 px-8 py-4 text-lg font-semibold text-white shadow-md hover:bg-accent-700"
          >
            <FolderOpen aria-hidden className="size-6" />
            {t('welcome.open')}
          </button>
          <p className="mt-4 text-neutral-600 dark:text-neutral-300" aria-live="polite">
            {dragging ? t('welcome.dropActive') : t('welcome.dropHint')}
          </p>
          <button
            type="button"
            onClick={() => void openSample()}
            className={`${buttonStyles.secondary} mt-6`}
          >
            <Sparkles aria-hidden className="size-4" />
            {t('welcome.trySample')}
          </button>
        </section>

        <p className="mt-6 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          {t('app.privacy')}
        </p>

        <RecentFiles />

        <footer className="mt-auto pt-10 text-xs text-neutral-500 dark:text-neutral-400">
          <EngineProgress />
          <p className="mt-3">
            {t('app.version', { version: __APP_VERSION__ })} · {t('app.license')} ·{' '}
            <a
              className="underline hover:text-accent-600"
              href={__SOURCE_URL__}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('app.sourceCode')}
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
