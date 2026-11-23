import { describe, expect, it, vi } from 'vitest';
import { BrowserFontProvider } from './BrowserFontProvider';

describe('BrowserFontProvider', () => {
  it('offers the bundled families with all four styles', () => {
    const fonts = new BrowserFontProvider('/edytor-pdf/', undefined);
    const ids = fonts.families().map((f) => f.id);
    expect(ids).toEqual(['noto-sans', 'noto-serif', 'roboto', 'lato', 'open-sans', 'latin-modern']);
    expect(fonts.family('latin-modern')?.styles).toEqual([
      'regular',
      'bold',
      'italic',
      'bold-italic',
    ]);
    expect(fonts.cssFamily('roboto')).toBe('EdytorPdf-roboto');
  });

  it('downloads bundled font files from the app itself, once', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]))));
    vi.stubGlobal('fetch', fetchMock);
    const fonts = new BrowserFontProvider('/base/', undefined);
    const bytes = await fonts.getBytes('lato:bold-italic');
    await fonts.getBytes('lato:bold-italic');
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/base/fonts/lato/Lato-bold-italic.ttf');
    vi.unstubAllGlobals();
  });

  it('adds user fonts and notifies listeners', async () => {
    const fonts = new BrowserFontProvider('/', undefined);
    const listener = vi.fn();
    fonts.subscribe(listener);
    const family = await fonts.addFamily(
      'Mój font',
      [{ style: 'regular', bytes: new Uint8Array([9]) }],
      'custom',
    );
    expect(family.styles).toEqual(['regular']);
    expect(fonts.family(family.id)?.name).toBe('Mój font');
    expect(Array.from(await fonts.getBytes(`${family.id}:regular`))).toEqual([9]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown fonts', async () => {
    const fonts = new BrowserFontProvider('/', undefined);
    await expect(fonts.getBytes('nope:regular')).rejects.toThrow('Unknown font');
  });
});
