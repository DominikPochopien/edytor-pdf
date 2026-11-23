import { describe, expect, it } from 'vitest';
import { styleFromName } from './BrowserLocalFonts';

describe('styleFromName', () => {
  it.each([
    ['Regular', 'regular'],
    ['Bold', 'bold'],
    ['Italic', 'italic'],
    ['Bold Italic', 'bold-italic'],
    ['BoldOblique', 'bold-italic'],
    ['Oblique', 'italic'],
    ['Light', null],
    ['SemiBold', null],
    ['', 'regular'],
  ])('%j → %j', (input, expected) => {
    expect(styleFromName(input)).toBe(expected);
  });
});
