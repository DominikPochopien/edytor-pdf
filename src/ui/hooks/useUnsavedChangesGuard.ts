import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../store/editorStore';
import { useViewerStore } from '../store/viewerStore';

/** Shows "*" in the tab title and asks before the tab is closed with unsaved changes. */
export function useUnsavedChangesGuard(): void {
  const { t } = useTranslation();
  const dirty = useEditorStore((s) => s.snapshot.dirty);
  const fileName = useViewerStore((s) => s.document?.fileName);

  useEffect(() => {
    const appName = t('app.name');
    document.title =
      fileName === undefined ? appName : `${dirty ? '* ' : ''}${fileName} – ${appName}`;
  }, [dirty, fileName, t]);

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);
}
