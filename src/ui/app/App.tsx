import * as Tooltip from '@radix-ui/react-tooltip';
import { lazy, Suspense } from 'react';
import { AboutDialog } from '../components/dialogs/AboutDialog';
import { LinkConfirmDialog } from '../components/dialogs/LinkConfirmDialog';
import { PasswordDialog } from '../components/dialogs/PasswordDialog';
import { ShortcutsDialog } from '../components/dialogs/ShortcutsDialog';
import { MobileNotice } from '../components/feedback/BrowserNotices';
import { ErrorToast } from '../components/feedback/ErrorToast';
import { OpeningOverlay } from '../components/feedback/OpeningOverlay';
import { WelcomeScreen } from '../components/welcome/WelcomeScreen';
import { useEngineLoader } from '../hooks/useEngineLoader';
import { useFileDrop } from '../hooks/useFileDrop';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useViewerStore } from '../store/viewerStore';
import { useServices } from './services';

const TOOLTIP_DELAY_MS = 400;

// The editor is loaded on demand, so the welcome screen appears as fast as possible.
const EditorLayout = lazy(() =>
  import('../components/editor/EditorLayout').then((m) => ({ default: m.EditorLayout })),
);

export function App() {
  const { isMobile } = useServices();
  const document = useViewerStore((s) => s.document);
  useEngineLoader();
  useKeyboardShortcuts();
  const dragging = useFileDrop();

  return (
    <Tooltip.Provider delayDuration={TOOLTIP_DELAY_MS}>
      <div className="flex h-full flex-col">
        {isMobile && <MobileNotice />}
        <div className="min-h-0 flex-1">
          {document === null ? (
            <WelcomeScreen dragging={dragging} />
          ) : (
            <Suspense fallback={null}>
              <EditorLayout document={document} />
            </Suspense>
          )}
        </div>
      </div>
      <OpeningOverlay />
      <PasswordDialog />
      <LinkConfirmDialog />
      <ShortcutsDialog />
      <AboutDialog />
      <ErrorToast />
    </Tooltip.Provider>
  );
}
