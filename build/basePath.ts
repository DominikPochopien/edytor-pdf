/** Default path when the app is published as a GitHub Pages project site. */
export const DEFAULT_BASE_PATH = '/edytor-pdf/';

/**
 * Normalizes a base path from the environment so that it always starts and ends with "/".
 * "/" means the root of a domain; an empty value falls back to the GitHub Pages default.
 */
export function resolveBasePath(raw: string | undefined): string {
  const value = raw?.trim();
  if (value === undefined || value === '') {
    return DEFAULT_BASE_PATH;
  }
  if (value === '.' || value === './') {
    return './';
  }
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}
