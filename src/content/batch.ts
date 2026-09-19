export type BatchScheduler = (run: () => void) => void;

export interface BatchOptions {
  // Omit for microtask coalescing; set a delay to coalesce on a timer instead.
  delayMs?: number;
}

const microtask: BatchScheduler = (run) => {
  queueMicrotask(run);
};

function timeout(delayMs: number): BatchScheduler {
  return (run) => {
    setTimeout(run, delayMs);
  };
}

function scheduler(options: BatchOptions): BatchScheduler {
  return options.delayMs === undefined ? microtask : timeout(options.delayMs);
}

export interface Batcher<T> {
  add(item: T): void;
}

export function createBatcher<T>(
  flush: (items: T[]) => void,
  options: BatchOptions = {},
): Batcher<T> {
  const schedule = scheduler(options);
  const pending = new Set<T>();
  let scheduled = false;

  return {
    add(item) {
      pending.add(item);
      if (scheduled) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        const items = Array.from(pending);
        pending.clear();
        flush(items);
      });
    },
  };
}

export interface Coalescer {
  schedule(): void;
}

export function createCoalescer(flush: () => void, options: BatchOptions = {}): Coalescer {
  const schedule = scheduler(options);
  let scheduled = false;

  return {
    schedule() {
      if (scheduled) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        flush();
      });
    },
  };
}
