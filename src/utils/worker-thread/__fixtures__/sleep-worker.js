const { parentPort, workerData } = require('worker_threads');

const { delayMs, result, shouldThrow } = workerData;

setTimeout(() => {
  if (shouldThrow) {
    throw new Error('sleep-worker: intentional failure');
  }
  parentPort.postMessage(result);
}, delayMs);
