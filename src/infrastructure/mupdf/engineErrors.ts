import type { AppErrorCode } from '../../application/errors';

/** The PDF header may be preceded by junk; the spec allows it within the first kilobyte. */
const PDF_HEADER_SEARCH_BYTES = 1024;
const PDF_HEADER = '%PDF-';

const MEMORY_PATTERNS = [
  /out of memory/i,
  /cannot enlarge memory/i,
  /\bOOM\b/,
  /memory access out of bounds/i,
];

export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, PDF_HEADER_SEARCH_BYTES);
  let text = '';
  for (const byte of head) {
    text += String.fromCharCode(byte);
  }
  return text.includes(PDF_HEADER);
}

/** Maps an exception thrown by MuPDF / WebAssembly to an application error code. */
export function classifyEngineError(error: unknown): AppErrorCode {
  if (error instanceof RangeError) {
    return 'out-of-memory';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (MEMORY_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'out-of-memory';
  }
  return 'unknown';
}
