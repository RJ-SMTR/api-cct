import { parentPort, workerData } from 'worker_threads';
import * as xlsx from 'xlsx';

export function parseWorksheetFromBuffer(buffer: Buffer): xlsx.WorkSheet {
  const workbook = xlsx.read(buffer, {
    type: 'buffer',
    codepage: 65001 /* UTF8 */,
  });
  const sheetName = workbook.SheetNames[0];
  return workbook.Sheets[sheetName];
}

if (parentPort) {
  const worksheet = parseWorksheetFromBuffer(workerData as Buffer);
  parentPort.postMessage(worksheet);
}
