import { describe, expect, it } from 'vitest';
import { AppError, isAppErrorCode, toAppError } from './AppError';

describe('AppError', () => {
  it('keeps the code and the cause', () => {
    const cause = new Error('boom');
    const error = toAppError(cause);
    expect(error.code).toBe('unknown');
    expect(error.cause).toBe(cause);
  });

  it('passes AppError through unchanged', () => {
    const error = new AppError('not-a-pdf');
    expect(toAppError(error)).toBe(error);
  });

  it('recognises valid codes', () => {
    expect(isAppErrorCode('file-corrupted')).toBe(true);
    expect(isAppErrorCode('nope')).toBe(false);
    expect(isAppErrorCode(42)).toBe(false);
  });
});
