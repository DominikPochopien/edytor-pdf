import { describe, expect, it } from 'vitest';
import { CancelledError, TaskQueue } from './taskQueue';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('TaskQueue', () => {
  it('runs the most urgent task first', async () => {
    const queue = new TaskQueue(1);
    const order: string[] = [];
    const gate = deferred();
    const first = queue.enqueue('blocker', 5, async () => {
      await gate.promise;
      order.push('blocker');
    });
    const low = queue.enqueue('low', 9, () => {
      order.push('low');
      return Promise.resolve();
    });
    const high = queue.enqueue('high', 0, () => {
      order.push('high');
      return Promise.resolve();
    });
    gate.resolve();
    await Promise.all([first.promise, low.promise, high.promise]);
    expect(order).toEqual(['blocker', 'high', 'low']);
  });

  it('merges requests with the same key', async () => {
    const queue = new TaskQueue(1);
    let runs = 0;
    const run = (): Promise<number> => {
      runs += 1;
      return Promise.resolve(42);
    };
    const a = queue.enqueue('page-1', 1, run);
    const b = queue.enqueue('page-1', 1, run);
    expect(await a.promise).toBe(42);
    expect(await b.promise).toBe(42);
    expect(runs).toBe(1);
  });

  it('cancels a task that has not started', async () => {
    const queue = new TaskQueue(1);
    const gate = deferred();
    const blocker = queue.enqueue('blocker', 0, () => gate.promise);
    let ran = false;
    const task = queue.enqueue('later', 1, () => {
      ran = true;
      return Promise.resolve();
    });
    task.cancel();
    gate.resolve();
    await blocker.promise;
    await expect(task.promise).rejects.toBeInstanceOf(CancelledError);
    expect(ran).toBe(false);
    expect(queue.pendingCount).toBe(0);
  });

  it('keeps a shared task alive while another subscriber still waits', async () => {
    const queue = new TaskQueue(1);
    const gate = deferred();
    const blocker = queue.enqueue('blocker', 0, () => gate.promise);
    const a = queue.enqueue('shared', 1, () => Promise.resolve('ok'));
    const b = queue.enqueue('shared', 1, () => Promise.resolve('ok'));
    a.cancel();
    gate.resolve();
    await blocker.promise;
    await expect(a.promise).rejects.toBeInstanceOf(CancelledError);
    await expect(b.promise).resolves.toBe('ok');
  });

  it('propagates errors', async () => {
    const queue = new TaskQueue(1);
    const task = queue.enqueue('bad', 0, () => Promise.reject(new Error('render failed')));
    await expect(task.promise).rejects.toThrow('render failed');
  });
});
