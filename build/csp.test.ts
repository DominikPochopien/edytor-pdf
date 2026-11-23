import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from './csp';

function directive(name: string): string | undefined {
  return CONTENT_SECURITY_POLICY.split('; ').find((d) => d.startsWith(`${name} `));
}

describe('Content Security Policy', () => {
  it('allows scripts only from the app itself, plus WebAssembly compilation', () => {
    expect(directive('script-src')).toBe("script-src 'self' 'wasm-unsafe-eval'");
  });

  it('never lets the app contact another server', () => {
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:/);
  });

  it('blocks plugins and form submissions', () => {
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('form-action')).toBe("form-action 'none'");
  });
});
