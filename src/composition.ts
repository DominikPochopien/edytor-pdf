import { EditorSession } from './application/commands';
import { DocumentSession } from './application/use-cases';
import { BYTES_PER_MIB } from './domain/units';
import { PageImageService } from './application/viewer';
import { BrowserFileAccess } from './infrastructure/files/BrowserFileAccess';
import { BrowserFileSaver } from './infrastructure/files/BrowserFileSaver';
import { WorkerPdfEngine } from './infrastructure/mupdf/WorkerPdfEngine';
import type { BrowserSupport } from './infrastructure/platform/browserSupport';
import { IdbRecentFilesStore } from './infrastructure/storage/IdbRecentFilesStore';
import type { AppServices } from './ui/app/services';

/** Memory for cached page bitmaps; older pages are released and re-rendered when needed. */
const PAGE_CACHE_MIB = 256;
const PAGE_CACHE_BYTES = PAGE_CACHE_MIB * BYTES_PER_MIB;
const SAMPLE_FILE = 'przyklad.pdf';

/** Composition root: the only place that knows which implementation backs each port. */
export function createServices(support: BrowserSupport, pickerDescription: string): AppServices {
  const engine = new WorkerPdfEngine();
  const images = new PageImageService(engine, { maxCacheBytes: PAGE_CACHE_BYTES });
  const recentFiles = new IdbRecentFilesStore();
  const session = new DocumentSession({
    loader: engine,
    recentFiles,
    images,
    onWarning: (message, error) => {
      if (import.meta.env.DEV) {
        console.warn(message, error);
      }
    },
  });
  return {
    engine,
    text: engine,
    images,
    session,
    editor: new EditorSession(),
    writer: engine,
    files: new BrowserFileAccess(pickerDescription),
    saver: new BrowserFileSaver(pickerDescription),
    loadObjectLayers: () =>
      import('./infrastructure/fabric/FabricObjectLayer').then((m) => m.fabricObjectLayerFactory),
    newId: () => crypto.randomUUID(),
    recentFiles,
    sampleUrl: `${import.meta.env.BASE_URL}${SAMPLE_FILE}`,
    isMobile: support.isMobile,
    onEngineReset: (listener) => engine.onReset(listener),
  };
}
