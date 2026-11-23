/** URL schemes a link from a PDF may open (after the user confirms). */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export type LinkCheck =
  | { readonly safe: true; readonly url: string }
  | { readonly safe: false; readonly reason: 'unsupported-scheme' | 'invalid' };

/**
 * Checks whether an external link from a PDF can be opened in a new tab.
 * JavaScript, file and data URLs are never opened.
 */
export function checkExternalLink(uri: string): LinkCheck {
  let parsed: URL;
  try {
    parsed = new URL(uri.trim());
  } catch {
    return { safe: false, reason: 'invalid' };
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { safe: false, reason: 'unsupported-scheme' };
  }
  return { safe: true, url: parsed.href };
}
