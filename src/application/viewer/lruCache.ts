/** Least-recently-used cache limited by a total "cost" (e.g. bytes of bitmap memory). */
export class LruCache<K, V> {
  private readonly entries = new Map<K, { value: V; cost: number }>();
  private totalCost = 0;

  constructor(
    private readonly maxCost: number,
    private readonly costOf: (value: V) => number,
    private readonly onEvict: (value: V, key: K) => void = () => undefined,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get cost(): number {
    return this.totalCost;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  set(key: K, value: V): void {
    this.delete(key);
    const cost = this.costOf(value);
    this.entries.set(key, { value, cost });
    this.totalCost += cost;
    this.evictOverflow(key);
  }

  delete(key: K): void {
    const entry = this.entries.get(key);
    if (entry !== undefined) {
      this.entries.delete(key);
      this.totalCost -= entry.cost;
      this.onEvict(entry.value, key);
    }
  }

  /** Removes every entry whose key matches the predicate. */
  deleteWhere(predicate: (key: K) => boolean): void {
    for (const key of [...this.entries.keys()]) {
      if (predicate(key)) {
        this.delete(key);
      }
    }
  }

  clear(): void {
    this.deleteWhere(() => true);
  }

  private evictOverflow(protectedKey: K): void {
    for (const key of this.entries.keys()) {
      if (this.totalCost <= this.maxCost) {
        return;
      }
      if (key !== protectedKey) {
        this.delete(key);
      }
    }
  }
}
