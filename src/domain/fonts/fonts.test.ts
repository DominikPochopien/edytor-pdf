import { describe, expect, it } from 'vitest';
import { availableStyle, fontKey, fontStyleKey } from './fonts';

describe('fonts', () => {
  it('maps bold/italic to a style key', () => {
    expect(fontStyleKey(false, false)).toBe('regular');
    expect(fontStyleKey(true, false)).toBe('bold');
    expect(fontStyleKey(false, true)).toBe('italic');
    expect(fontStyleKey(true, true)).toBe('bold-italic');
    expect(fontKey('noto-sans', 'bold')).toBe('noto-sans:bold');
  });

  it('falls back to regular for families without the style', () => {
    const custom = {
      id: 'c',
      name: 'Mój font',
      category: 'custom' as const,
      styles: ['regular' as const],
    };
    expect(availableStyle(custom, true, true)).toBe('regular');
    const full = { ...custom, styles: ['regular', 'bold', 'italic', 'bold-italic'] as const };
    expect(availableStyle(full, true, false)).toBe('bold');
  });
});
