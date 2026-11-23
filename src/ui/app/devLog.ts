/** Technical details go to the console only in development builds (users see Polish messages). */
export function logDev(message: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(message, error);
  }
}
