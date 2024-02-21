import { CNAB_SUPPORTED_FORMATS } from './cnab-consts';
import { getCnabPictureValue } from './cnab-field-utils';
import { CnabField } from './types/cnab-field.type';
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
  cnab: Record<string, CnabRegistro | CnabRegistro[] | CnabLote[]>,
): CnabRegistro[] {
  // return
  const plainCnab: CnabRegistro[] = [];
  for (const value of Object.values(cnab)) {
    if (Array.isArray(value)) {
      if (isCnabLote(value)) {
        for (const lote of value as CnabLote[]) {
          plainCnab.push(...getPlainRegistros(lote));
        }
      } else {
        plainCnab.push(...(value as CnabRegistro[]));
      }
    } else {
      plainCnab.push(value);
    }
  }
  return plainCnab;
}
