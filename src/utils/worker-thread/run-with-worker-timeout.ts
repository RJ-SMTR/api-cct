import { Worker } from 'worker_threads';

export class WorkerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Worker timed out after ${timeoutMs}ms`);
    this.name = 'WorkerTimeoutError';
  }
}

export function runWithWorkerTimeout<TOutput = unknown>(
  workerFilePath: string,
  workerData: unknown,
  timeoutMs: number,
): Promise<TOutput> {
  return new Promise<TOutput>((resolve, reject) => {
    const worker = new Worker(workerFilePath, { workerData });
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => reject(new WorkerTimeoutError(timeoutMs)));
    }, timeoutMs);

    worker.once('message', (result: TOutput) => {
      settle(() => resolve(result));
    });

    worker.once('error', (error) => {
      settle(() => reject(error));
    });
  });
}
