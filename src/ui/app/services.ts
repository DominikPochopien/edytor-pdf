import { createContext, use } from 'react';
import type { EditorSession } from '../../application/commands';
import type {
  FileAccess,
  FileSaver,
  ObjectLayerFactory,
  PdfDocumentWriter,
  PdfEngineLoader,
  PdfTextExtractor,
  RecentFilesStore,
} from '../../application/ports';
import type { DocumentSession, IdGenerator } from '../../application/use-cases';
import type { PageImageService } from '../../application/viewer';

/** Everything the UI needs from the outer layers, created once in the composition root. */
export interface AppServices {
  readonly engine: PdfEngineLoader;
  readonly text: PdfTextExtractor;
  readonly images: PageImageService;
  readonly session: DocumentSession;
  /** Edits of the open document with Undo/Redo. */
  readonly editor: EditorSession;
  readonly writer: PdfDocumentWriter;
  readonly files: FileAccess;
  readonly saver: FileSaver;
  /** The editing layer library is loaded on demand, together with the editor screen. */
  readonly loadObjectLayers: () => Promise<ObjectLayerFactory>;
  readonly newId: IdGenerator;
  readonly recentFiles: RecentFilesStore;
  readonly sampleUrl: string;
  readonly isMobile: boolean;
  readonly onEngineReset: (listener: () => void) => () => void;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = use(ServicesContext);
  if (services === null) {
    throw new Error('ServicesContext is missing');
  }
  return services;
}
