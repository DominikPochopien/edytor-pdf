import { describe, expect, it } from 'vitest';
import { parsePageInput } from './pageNumber';
import { firstHitFromPage, nextHitIndex, previousHitIndex } from './searchNavigation';

describe('parsePageInput', () => {
  it('accepts page numbers in range', () => {
    expect(parsePageInput(' 3 ', 10)).toBe(2);
    expect(parsePageInput('10', 10)).toBe(9);
  });

  it.each(['0', '11', '-1', 'abc', '', '2.5'])('rejects %j', (input) => {
    expect(parsePageInput(input, 10)).toBeNull();
  });
});

describe('search navigation', () => {
  it('wraps around', () => {
    expect(nextHitIndex(null, 3)).toBe(0);
    expect(nextHitIndex(2, 3)).toBe(0);
    expect(previousHitIndex(0, 3)).toBe(2);
    expect(previousHitIndex(null, 3)).toBe(2);
    expect(nextHitIndex(null, 0)).toBeNull();
    expect(previousHitIndex(null, 0)).toBeNull();
  });

  it('starts from the current page', () => {
    expect(firstHitFromPage([0, 0, 4, 7], 3)).toBe(2);
    expect(firstHitFromPage([0, 2], 5)).toBe(0);
    expect(firstHitFromPage([], 0)).toBeNull();
  });
});
