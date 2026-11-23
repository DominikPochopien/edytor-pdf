import { useSearchRunner } from '../../hooks/useSearch';
import { PropertiesPanel } from '../properties/PropertiesPanel';
import type { OpenedDocument } from '../../store/viewerStore';
import { useViewerStore } from '../../store/viewerStore';
import { DocumentView } from '../viewer/DocumentView';
import { Sidebar } from '../viewer/Sidebar';
import { StatusBar } from '../viewer/StatusBar';
import { Toolbar } from './Toolbar';

export function EditorLayout({ document }: { readonly document: OpenedDocument }) {
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  useSearchRunner();

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar document={document} />}
        <DocumentView key={document.info.id} document={document} />
        <PropertiesPanel />
      </div>
      <StatusBar document={document} />
    </div>
  );
}
