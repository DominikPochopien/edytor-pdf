export interface BrowserSupport {
  /** Everything the editor needs is available. */
  readonly supported: boolean;
  readonly missing: readonly string[];
  /** Saving straight to a file on disk (Chrome, Edge). Elsewhere files are downloaded. */
  readonly canSaveInPlace: boolean;
  /** Small touch screen: the app is designed for computers, preview may still work. */
  readonly isMobile: boolean;
}

const MOBILE_MAX_WIDTH = 820;

export function detectBrowserSupport(win: Window & typeof globalThis = window): BrowserSupport {
  const missing: string[] = [];
  if (typeof win.WebAssembly !== 'object') {
    missing.push('WebAssembly');
  }
  if (typeof win.Worker !== 'function') {
    missing.push('Web Workers');
  }
  if (typeof win.createImageBitmap !== 'function') {
    missing.push('createImageBitmap');
  }
  if (typeof win.indexedDB !== 'object') {
    missing.push('IndexedDB');
  }
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  return {
    supported: missing.length === 0,
    missing,
    canSaveInPlace: 'showSaveFilePicker' in win,
    isMobile: coarse && win.innerWidth <= MOBILE_MAX_WIDTH,
  };
}
