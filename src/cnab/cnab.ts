import { isDate } from 'date-fns';
import format from 'date-fns/format';
import { CnabFieldType } from './enums/cnab-field-type.enum';
import { CnabField } from './types/cnab-field.type';
import { CnabRegistro } from './types/cnab-registro.type';

export const Cnab = {
  formatCnabNumber,
  formatCnabText,
  formatCurrency,
  formatDate,
  getFieldType,
  getPictureValue,
  getRegistroLine,
  regexPicture,
  validateFieldFormat,
};

/**
 * Convert CNAB Registro into CNAB file line
 */
function getRegistroLine(registro: CnabRegistro) {
  let line = '';
  for (const value of Object.values(registro)) {
    line += getPictureValue(value);
  }
  return line;
}

/**
 * form CnabField get formatted value applying Picture
 */
function getPictureValue(item: CnabField) {
  if (getFieldType(item) === CnabFieldType.Currency) {
    return formatCurrency(item);
  } else if (getFieldType(item) === CnabFieldType.Date) {
    return formatDate(item);
  } else if (getFieldType(item) === CnabFieldType.Number) {
    return formatCnabNumber(item);
  } else if (getFieldType(item) === CnabFieldType.Text) {
    return formatCnabText(item);
  }
}
function getFieldType(item: CnabField): CnabFieldType {
  let result: CnabFieldType | undefined = undefined;
  if (item.picture.indexOf('V9') > 0) {
    result = CnabFieldType.Currency;
  } else if (item.picture.startsWith('9')) {
    if (item.dateFormat) {
      result = CnabFieldType.Date;
    } else {
      result = CnabFieldType.Number;
    }
  } else if (item.picture.startsWith('X')) {
    result = CnabFieldType.Text;
  }

  if (!result) {
    throw new Error(`Cant recognize picture for ${item.picture}`);
  }
  validateFieldFormat(item);

  return result;
}

function validateFieldFormat(item: CnabField) {
  if (item.value === null) {
    throw new Error('No formats allow null item value');
  } else if (isNaN(Number(item.value))) {
    throw new Error('Number format cant represent NaN value');
  }
}

function regexPicture(exp: any, picture: any) {
  const regex = new RegExp(exp);
  const text = picture; // "9(10)V9(10)",
  let result: RegExpExecArray | null = null;
  const out: string[] = [];
  // _tslint_:disable-next-line:no-conditional-assignment
  while ((result = regex.exec(text))) {
    out.push(result[1]);
  }

  return out;
}

/**
 * Alfanumérico (picture X): alinhados à esquerda com brancos à direita. Preferencialmente,
 * todos os caracteres devem ser maiúsculos. Aconselhase a não utilização de
 * caracteres especiais (ex.: “Ç”, “?”,, etc) e
 * acentuação gráfica (ex.: “Á”, “É”, “Ê”, etc) e os campos não utiliza dos deverão ser preenchidos com brancos.
 */
function formatCnabText(item: CnabField) {
  const out = regexPicture(/X\((\w+?)\)/g, item.picture);
  const size = Number(out[0]);
  return String(item.value).slice(0, size).padEnd(size, ' ');
}

/** Numérico (picture 9): alinhado à direita com zeros à esquerda e os campos não utilizados deverão ser preenchidos
 * com zeros. - Vírgula assumida (picture V): indica a posição da vírgula dentro de um campo numérico.
 * Exemplo: num campo com picture “9(5)V9(2)”, o número “876,54” será representado por “0087654”
 */
function formatCnabNumber(item: CnabField): string {
  const out = regexPicture(/9\((\w+?)\)/g, item.picture);
  const size = Number(out[0]);
  return String(Number(item.value).toFixed(0)).padStart(size, '0');
}

/**
 * @param item for string data inputs use only numbers:
 * - `HHMMSS` = "992359"
 * - `ddMMyyyy` = "31121030"
 * - `ddMMyy` = "311230"
 * @returns
 */
function formatDate(item: CnabField) {
  if (isDate(item.value) && item.dateFormat) {
    return format(item.value, item.dateFormat);
  } else {
    const out = regexPicture(/9\((\w+?)\)/g, item.picture);
    const itemValue = String(item.value);
    const size = Number(out[0]);
    return itemValue.slice(size).padStart(size, '0');
  }
}

function formatCurrency(item: CnabField) {
  const out = regexPicture(/9\((\w+?)\)/g, item.picture);
  const integer = Number(out[0]);
  const decimal = Number(out[1]);
  const result = String(Number(item.value).toFixed(decimal))
    .replace('.', '')
    .padStart(integer + decimal, '0');
  if (result.length > integer + decimal) {
    throw new Error(
      `Number "${result}" is too big to fit Currency Picture ` +
        `${item.picture} (picture lenght: ${integer + decimal})`,
    );
  }
  return result;
}
