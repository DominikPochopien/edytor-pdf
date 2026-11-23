/** Error codes shown to the user as Polish messages (see ui/i18n, key "errors.<code>"). */
export const APP_ERROR_CODES = [
  'engine-load-failed',
  'browser-unsupported',
  'not-a-pdf',
  'file-corrupted',
  'file-too-large',
  'out-of-memory',
  'password-required',
  'password-incorrect',
  'document-closed',
  'render-failed',
  'file-read-failed',
  'save-failed',
  'unknown',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, detail?: string, options?: ErrorOptions) {
    super(detail ?? code, options);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && (APP_ERROR_CODES as readonly string[]).includes(value);
}

/** Converts anything thrown into an AppError, keeping the original as the cause. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new AppError('unknown', detail, { cause: error });
}
