import type { AppErrorCode } from './AppError';

/** Result type used across the worker boundary, where Error subclasses cannot be transferred. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: AppErrorCode; readonly detail: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: AppErrorCode, detail: string): Result<T> {
  return { ok: false, code, detail };
}
