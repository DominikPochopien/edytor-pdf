import { createContext, use } from 'react';
import type {
  FileAccess,
  PdfEngineLoader,
  PdfTextExtractor,
  RecentFilesStore,
} from '../../application/ports';
import type { DocumentSession } from '../../application/use-cases';
import type { PageImageService } from '../../application/viewer';

/** Everything the UI needs from the outer layers, created once in the composition root. */
export interface AppServices {
  readonly engine: PdfEngineLoader;
  readonly text: PdfTextExtractor;
  readonly images: PageImageService;
  readonly session: DocumentSession;
  readonly files: FileAccess;
  readonly recentFiles: RecentFilesStore;
  readonly sampleUrl: string;
  readonly canSaveInPlace: boolean;
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
