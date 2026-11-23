import type { Plugin } from 'vite';

/**
 * Content Security Policy delivered through a <meta> tag, because GitHub Pages
 * does not allow custom response headers. Only same-origin resources are allowed;
 * 'wasm-unsafe-eval' is required to compile the MuPDF WebAssembly module.
 * frame-ancestors cannot be set from a meta tag (see docs/HOSTING.md for header-based hosts).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // Radix dialogs inject a small <style> element to lock page scrolling while open; its content
  // depends on the scrollbar width, so a hash cannot be used. Styles cannot execute code.
  "style-src 'self' 'unsafe-inline'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const CSP_PLACEHOLDER = '<!-- CSP -->';

/** Injects the CSP meta tag into index.html in production builds only (Vite dev uses inline styles). */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'edytor-pdf:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        CSP_PLACEHOLDER,
        `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      );
    },
  };
}
