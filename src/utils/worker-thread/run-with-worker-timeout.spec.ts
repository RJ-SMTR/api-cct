import * as path from 'path';
import { Worker } from 'worker_threads';
import { runWithWorkerTimeout, WorkerTimeoutError } from './run-with-worker-timeout';

const SLEEP_WORKER = path.join(__dirname, '__fixtures__', 'sleep-worker.js');

describe('runWithWorkerTimeout', () => {
  // The worker only needs ~10ms of actual work, but spawning a real worker_thread can take
  // well over 1000ms when this suite runs alongside the rest of the project's tests under CPU
  // contention (observed flake in `npm run validate`, never in isolation). The 1000ms budget
  // tested spawn latency, not the behavior under test; widen it and the per-test Jest timeout
  // so a slow spawn doesn't masquerade as a timeout rejection.
  it('resolves with the worker result when it finishes within the timeout', async () => {
    const result = await runWithWorkerTimeout(SLEEP_WORKER, { delayMs: 10, result: 'done' }, 5000);

    expect(result).toBe('done');
  }, 15000);

  it('rejects when the worker does not finish within the timeout', async () => {
    await expect(
      runWithWorkerTimeout(SLEEP_WORKER, { delayMs: 500, result: 'too late' }, 50),
    ).rejects.toThrow(/timed out/i);
  });

  it('always terminates the worker, whether it resolves or times out', async () => {
    const terminateSpy = jest.spyOn(Worker.prototype, 'terminate');

    await runWithWorkerTimeout(SLEEP_WORKER, { delayMs: 10, result: 'done' }, 5000);
    await runWithWorkerTimeout(SLEEP_WORKER, { delayMs: 500, result: 'too late' }, 50).catch(() => undefined);

    expect(terminateSpy).toHaveBeenCalledTimes(2);

    terminateSpy.mockRestore();
  }, 15000);

  it('rejects with the worker error, not a timeout error, when the worker throws', async () => {
    await expect(
      runWithWorkerTimeout(SLEEP_WORKER, { delayMs: 10, shouldThrow: true }, 5000),
    ).rejects.toThrow(/intentional failure/i);
  }, 15000);

  it('rejects immediately instead of hanging when timeoutMs is zero', async () => {
    await expect(
      runWithWorkerTimeout(SLEEP_WORKER, { delayMs: 50, result: 'too late' }, 0),
    ).rejects.toThrow(WorkerTimeoutError);
  });
});
