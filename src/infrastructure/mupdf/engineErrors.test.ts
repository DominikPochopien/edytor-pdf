import { describe, expect, it } from 'vitest';
import { classifyEngineError, looksLikePdf } from './engineErrors';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('looksLikePdf', () => {
  it('finds the header at the start or after junk', () => {
    expect(looksLikePdf(encode('%PDF-1.7\n...'))).toBe(true);
    expect(looksLikePdf(encode('garbage\n%PDF-1.4'))).toBe(true);
  });

  it('rejects other files', () => {
    expect(looksLikePdf(encode('PK\u0003\u0004 zip'))).toBe(false);
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });
});

describe('classifyEngineError', () => {
  it('detects memory errors', () => {
    expect(classifyEngineError(new RangeError('Array buffer allocation failed'))).toBe(
      'out-of-memory',
    );
    expect(classifyEngineError(new Error('Cannot enlarge memory arrays'))).toBe('out-of-memory');
    expect(classifyEngineError('Aborted(OOM)')).toBe('out-of-memory');
  });

  it('falls back to unknown', () => {
    expect(classifyEngineError(new Error('syntax error in xref'))).toBe('unknown');
  });
});
