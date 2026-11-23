export class CancelledError extends Error {
  constructor() {
    super('Task cancelled');
    this.name = 'CancelledError';
  }
}

export interface QueuedTask<T> {
  readonly promise: Promise<T>;
  /** Cancels the task if it has not started yet. A running task finishes normally. */
  cancel(): void;
}

interface Job {
  readonly key: string;
  priority: number;
  readonly order: number;
  readonly run: () => Promise<unknown>;
  readonly result: Promise<unknown>;
  settle: { resolve: (value: unknown) => void; reject: (reason: unknown) => void };
  subscribers: number;
  started: boolean;
}

/**
 * Priority queue for engine work (lower number = more urgent). Requests with the same key are
 * merged, so a page needed by two views is rendered once. The PDF engine is single-threaded,
 * so the default concurrency is 1: the most urgent page always goes next.
 */
export class TaskQueue {
  private readonly waiting = new Map<string, Job>();
  private readonly running = new Map<string, Job>();
  private sequence = 0;

  constructor(private readonly concurrency = 1) {}

  get pendingCount(): number {
    return this.waiting.size;
  }

  enqueue<T>(key: string, priority: number, run: () => Promise<T>): QueuedTask<T> {
    const job =
      this.waiting.get(key) ?? this.running.get(key) ?? this.createJob(key, priority, run);
    job.subscribers += 1;
    if (!job.started) {
      job.priority = Math.min(job.priority, priority);
    }

    let cancelled = false;
    const promise = job.result.then(
      (value) => (cancelled ? Promise.reject(new CancelledError()) : (value as T)),
      (error: unknown) => {
        if (cancelled) {
          throw new CancelledError();
        }
        throw error;
      },
    );
    // Rejections of cancelled tasks are expected; avoid "unhandled rejection" noise.
    promise.catch(() => undefined);
    this.pump();

    return {
      promise,
      cancel: () => {
        if (cancelled) {
          return;
        }
        cancelled = true;
        job.subscribers -= 1;
        if (!job.started && job.subscribers === 0) {
          this.waiting.delete(key);
          job.settle.reject(new CancelledError());
        }
      },
    };
  }

  private createJob(key: string, priority: number, run: () => Promise<unknown>): Job {
    const settle: Job['settle'] = { resolve: () => undefined, reject: () => undefined };
    const result = new Promise<unknown>((resolve, reject) => {
      settle.resolve = resolve;
      settle.reject = reject;
    });
    result.catch(() => undefined);
    const job: Job = {
      key,
      priority,
      order: this.sequence++,
      run,
      result,
      settle,
      subscribers: 0,
      started: false,
    };
    this.waiting.set(key, job);
    return job;
  }

  private nextJob(): Job | undefined {
    let best: Job | undefined;
    for (const job of this.waiting.values()) {
      const better =
        best === undefined ||
        job.priority < best.priority ||
        (job.priority === best.priority && job.order < best.order);
      if (better) {
        best = job;
      }
    }
    return best;
  }

  private pump(): void {
    while (this.running.size < this.concurrency) {
      const job = this.nextJob();
      if (job === undefined) {
        return;
      }
      this.waiting.delete(job.key);
      this.running.set(job.key, job);
      job.started = true;
      job
        .run()
        .then(job.settle.resolve, job.settle.reject)
        .finally(() => {
          this.running.delete(job.key);
          this.pump();
        });
    }
  }
}
