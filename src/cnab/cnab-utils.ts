import { Exception } from 'handlebars';
import { CNAB_SUPPORTED_FORMATS } from './cnab-consts';
import { getCnabPictureValue } from './cnab-field-utils';
import { CnabField } from './types/cnab-field.type';
import {
  CnabFileMapped,
  isCnabFileMapped,
} from './types/cnab-file-mapped.type';
import { CnabFile, isCnabFile } from './types/cnab-file.type';
import {
  CnabLoteMapped,
  isCnabLoteMapped,
} from './types/cnab-lote-mapped.type';
import { CnabLote, isCnabLote } from './types/cnab-lote.type';
import { CnabRegistro } from './types/cnab-registro.type';

/**
 * Convert CNAB Registro into CNAB file line
 */
export function getRegistroLine(registro: CnabRegistro) {
  let line = '';
  const registros = Object.values(registro);
  for (const i in registros) {
    const current = registros[i];
    validateRegistroPosition(
      current,
      registros[Number(i) - 1],
      Boolean(registros[Number(i) + 1]),
    );
    line += getCnabPictureValue(current);
  }
  return line;
}

/**
 * Validates if current item position matches position of previous item.
 */
export function validateRegistroPosition(
  current: CnabField,
  previous: CnabField | undefined,
  hasNext: boolean,
) {
  if (!previous && current.pos[0] !== 1) {
    throw new Error(
      `First CnabField position start should be 0 but is ${current.pos[0]}`,
    );
  }
  if (!hasNext && !CNAB_SUPPORTED_FORMATS.includes(current.pos[1])) {
    throw new Error(
      'Last CnabField position end should be one of these values' +
        `${CNAB_SUPPORTED_FORMATS} but is ${current.pos[1]}`,
    );
  } else if (previous && current.pos[0] !== previous?.pos[1] + 1) {
    throw new Error(
      'Current start and previous end item positions' +
        `should be both ${current.pos[0]} but are: previousEnd: ` +
        `${previous.pos[1]}, currentStart: ${current.pos[0]}`,
    );
  }
}

export function getPlainRegistros(
  cnab: CnabFile | CnabFileMapped | CnabLote | CnabLoteMapped,
): CnabRegistro[] {
  const plainRegistros: CnabRegistro[] = [];

  if (isCnabLote(cnab)) {
    plainRegistros.push(...getPlainRegistrosFromLote(cnab as CnabLote));
  } else if (isCnabLoteMapped(cnab)) {
    plainRegistros.push(
      ...getPlainRegistrosFromLoteMapped(cnab as CnabLoteMapped),
    );
  } else if (isCnabFile(cnab)) {
    plainRegistros.push(...getPlainRegistrosFromCnabFile(cnab as CnabFile));
  } else if (isCnabFileMapped(cnab)) {
    plainRegistros.push(
      ...getPlainRegistrosFromCnabFileMapped(cnab as CnabFileMapped),
    );
  } else {
    throw new Exception('Unsupported object type.');
  }
  return plainRegistros;
}

function getPlainRegistrosFromCnabFile(file: CnabFile): CnabRegistro[] {
  return [
    file.headerArquivo,
    ...file.lotes.reduce((l, i) => [...l, ...getPlainRegistrosFromLote(i)], []),
    file.trailerArquivo,
  ];
}

function getPlainRegistrosFromCnabFileMapped(
  file: CnabFileMapped,
): CnabRegistro[] {
  return [
    file.headerArquivo.registro,
    ...file.lotes.reduce(
      (l, i) => [...l, ...getPlainRegistrosFromLoteMapped(i)],
      [],
    ),
    file.trailerArquivo.registro,
  ];
}

function getPlainRegistrosFromLote(lote: CnabLote): CnabRegistro[] {
  return [lote.headerLote, ...lote.registros, lote.trailerLote];
}

function getPlainRegistrosFromLoteMapped(lote: CnabLoteMapped): CnabRegistro[] {
  return [
    lote.headerLote.registro,
    ...lote.registros.reduce((l, i) => [...l, i.registro], []),
    lote.trailerLote.registro,
  ];
}
