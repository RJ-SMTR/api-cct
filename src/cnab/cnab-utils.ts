import { Exception } from 'handlebars';
import { CNAB_SUPPORTED_FORMATS } from './cnab-consts';
import { getCnabPictureValue, parseField } from './cnab-field-utils';
import { CnabField } from './types/cnab-field.type';
import { CnabFile, isCnabFile } from './types/cnab-file.type';
import { CnabLote, isCnabLote } from './types/cnab-lote.type';
import { CnabRegistro } from './types/cnab-registro.type';

/**
 * Convert CNAB Registro into CNAB file line
 */
export function stringifyRegistro(registro: CnabRegistro) {
  let line = '';
  const registros = Object.values(registro.fields);
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

export function parseRegistro(
  cnab: string,
  registro: CnabRegistro,
  textStart = 0,
): CnabRegistro {
  const regEntries = Object.entries(registro.fields);
  const newRegistro: CnabRegistro = { fields: {} };
  for (let i = 0; i < regEntries.length; i++) {
    const [key, field] = regEntries[i];
    validateRegistroPosition(
      field,
      regEntries[i - 1][1],
      Boolean(regEntries[i + 1][1]),
    );
    newRegistro[key] = parseField(cnab, field, textStart);
  }
  return newRegistro;
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
      `First CnabField position start should be 1 but is ${current.pos[0]}`,
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

export function getCnabRegistros(cnab: CnabFile | CnabLote): CnabRegistro[] {
  const plainRegistros: CnabRegistro[] = [];

  if (isCnabLote(cnab)) {
    plainRegistros.push(...getCnabRegistrosFromLote(cnab as CnabLote));
  } else if (isCnabFile(cnab)) {
    plainRegistros.push(...getCnabRegistrosFromCnabFile(cnab as CnabFile));
  } else {
    throw new Exception('Unsupported object type.');
  }
  return plainRegistros;
}

function getCnabRegistrosFromCnabFile(file: CnabFile): CnabRegistro[] {
  return [
    file.headerArquivo,
    ...file.lotes.reduce((l, i) => [...l, ...getCnabRegistrosFromLote(i)], []),
    file.trailerArquivo,
  ];
}

function getCnabRegistrosFromLote(lote: CnabLote): CnabRegistro[] {
  return [lote.headerLote, ...lote.registros, lote.trailerLote];
}

export function stringifyCnab(cnab: CnabFile): string {
  return getCnabRegistros(cnab)
    .reduce((l, i) => [...l, stringifyRegistro(i)], [])
    .join('\r\n');
}

// export function parseCnab(str: string): CnabFile {

// }
