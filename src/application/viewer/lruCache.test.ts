import { describe, expect, it, vi } from 'vitest';
import { LruCache } from './lruCache';

describe('LruCache', () => {
  it('evicts the least recently used entry when over budget', () => {
    const evicted = vi.fn();
    const cache = new LruCache<string, number>(10, (v) => v, evicted);
    cache.set('a', 4);
    cache.set('b', 4);
    cache.get('a');
    cache.set('c', 4);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(evicted).toHaveBeenCalledWith(4, 'b');
    expect(cache.cost).toBe(8);
  });

  it('keeps the newest entry even when it alone exceeds the budget', () => {
    const cache = new LruCache<string, number>(5, (v) => v);
    cache.set('big', 50);
    expect(cache.has('big')).toBe(true);
  });

  it('releases replaced and deleted values', () => {
    const evicted = vi.fn();
    const cache = new LruCache<string, number>(100, (v) => v, evicted);
    cache.set('a', 1);
    cache.set('a', 2);
    cache.deleteWhere((k) => k === 'a');
    expect(evicted).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });
});
