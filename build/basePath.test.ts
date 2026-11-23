import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_PATH, resolveBasePath } from './basePath';

describe('resolveBasePath', () => {
  it('defaults to the GitHub Pages project path', () => {
    expect(resolveBasePath(undefined)).toBe(DEFAULT_BASE_PATH);
    expect(resolveBasePath('  ')).toBe(DEFAULT_BASE_PATH);
  });

  it('supports the domain root', () => {
    expect(resolveBasePath('/')).toBe('/');
  });

  it('adds missing slashes', () => {
    expect(resolveBasePath('narzedzia/pdf')).toBe('/narzedzia/pdf/');
    expect(resolveBasePath('/pdf')).toBe('/pdf/');
  });

  it('keeps a relative base', () => {
    expect(resolveBasePath('./')).toBe('./');
  });
});
