import { Exception } from 'handlebars';
import { CNAB_EOL, CNAB_SUPPORTED_FORMATS } from '../services/cnab-consts';
import { CnabAllCodigoRegistro } from '../enums/all/cnab-all-codigo-registro.enum';
import { ICnabFieldMap } from '../dto/CnabFieldMapDTO';
import { CnabField } from '../types/cnab-field.type';
import { CnabFile, isCnabFile } from '../types/cnab-file.type';
import { CnabLote, isCnabLote } from '../types/cnab-lote.type';
import { CnabRegistro } from '../types/cnab-registro.type';
import { parseField, stringifyCnabField } from './cnab-field-utils';

//Header do Arquivo
function getCnabRegistrosFromCnabFile(file: CnabFile): CnabRegistro[] {
  return [
    file.headerArquivo,
    ...file.lotes.reduce((l, i) => [...l, ...getCnabRegistrosFromLote(i)], []),
    file.trailerArquivo,
  ];
}

//Monta Header do Lote - Detalhes A e B - Trailer do Lote(rodapé)
function getCnabRegistrosFromLote(lote: CnabLote): CnabRegistro[] {
  return [lote.headerLote, ...lote.registros, lote.trailerLote];
}

/**
 * Process data in CnabFile, like sums, countings etc
 */
export function processCnabFile(cnab: CnabFile) {
  processCnabHeaderArquivo(cnab);
  processCnabLotes(cnab.lotes);
  processCnabTrailerArquivo(cnab);
}

/**
 * Validate and stringify Registro
 */
export function stringifyCnabRegistro(registro: CnabRegistro): string {
  validateCnabRegistro(registro);
  return getCnabFieldList(registro).reduce(
    (s, i) => s + stringifyCnabField(i),
    '',
  );
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
    validateCnabRegistroPosition(
      field,
      regEntries[i - 1][1],
      Boolean(regEntries[i + 1][1]),
    );
    newRegistro[key] = parseField(cnab, field, textStart);
  }
  return newRegistro;
}

/**
 * Get CnabField list sorted ascending by position, from CnabRegistro
 */
export function getCnabFieldList(registro: CnabRegistro): CnabField[] {
  const fields = Object.values(registro.fields);
  fields.sort((a, b) => a.pos[0] - b.pos[0]);
  return fields;
}

/**
 * Run all validations of CnabRegistro
 */
export function validateCnabRegistro(registro: CnabRegistro) {
  const fields = getCnabFieldList(registro);
  for (const i in fields) {
    const field = fields[i];
    validateCnabRegistroPosition(
      field,
      fields[Number(i) - 1],
      Boolean(fields[Number(i) + 1]),
    );
  }
}

/**
 * Validates if current item position matches position of previous item.
 */
export function validateCnabRegistroPosition(
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
      'Current start and previous end item positions ' +
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

export function stringifyCnabFile(cnab: CnabFile): string {
  const treatedCnab = structuredClone(cnab);
  processCnabFile(treatedCnab);
  return getCnabRegistros(treatedCnab)
    .reduce((l, i) => [...l, stringifyCnabRegistro(i)], [])
    .join(CNAB_EOL);
}

function processCnabHeaderArquivo(cnab: CnabFile) {
  setCnabMappedValue(
    cnab.headerArquivo,
    'registroIdField',
    CnabAllCodigoRegistro.HeaderArquivo,
  );
}

function processCnabTrailerArquivo(cnab: CnabFile) {
  const registrosArq: number = getCnabRegistros(cnab).length;
  setCnabMappedValue(
    cnab.trailerArquivo,
    'registroIdField',
    CnabAllCodigoRegistro.TrailerArquivo,
  );
  setCnabMappedValue(cnab.trailerArquivo, 'registroLoteSequenceField', 9999);
  setCnabMappedValue(
    cnab.trailerArquivo,
    'trailerArquivoRegistroCountField',
    registrosArq,
  );
  setCnabMappedValue(
    cnab.trailerArquivo,
    'trailerArquivoLoteCountField',
    cnab.lotes.length,
  );
}

function processCnabLotes(lotes: CnabLote[]) {
  for (let i = 0; i < lotes.length; i++) {
    processCnabHeaderLote(lotes, i);
    processCnabRegistros(lotes[i], i);
    processCnabTrailerLote(lotes, i);
  }
}

function processCnabHeaderLote(lotes: CnabLote[], loteIndex: number) {
  setCnabMappedValue(
    lotes[loteIndex].headerLote,
    'registroIdField',
    CnabAllCodigoRegistro.HeaderLote,
  );
  setCnabMappedValue(
    lotes[loteIndex].headerLote,
    'registroLoteSequenceField',
    loteIndex + 1,
  );
}

function processCnabTrailerLote(lotes: CnabLote[], loteIndex: number) {
  setCnabMappedValue(
    lotes[loteIndex].trailerLote,
    'registroIdField',
    CnabAllCodigoRegistro.TrailerLote,
  );
  setCnabMappedValue(
    lotes[loteIndex].trailerLote,
    'registroLoteSequenceField',
    loteIndex + 1,
  );
  setCnabMappedValue(
    lotes[loteIndex].trailerLote,
    'trailerLoteRegistroCountField',
    getCnabRegistros(lotes[loteIndex]).length,
  );
}

function processCnabRegistros(lote: CnabLote, loteIndex: number) {
  for (let i = 0; i < lote.registros.length; i++) {
    setCnabMappedValue(
      lote.registros[i],
      'registroIdField',
      CnabAllCodigoRegistro.DetalheSegmento,
    );
    setCnabMappedValue(
      lote.registros[i],
      'registroLoteSequenceField',
      loteIndex + 1,
    );
    setCnabMappedValue(
      lote.registros[i],
      'detalheLoteRegistroSequenceField',
      i + 1,
    );
  }
}

/**
 * Set value of Registro's CnabField using mapped key
 */
export function setCnabMappedValue(
  registro: CnabRegistro,
  mapField: keyof ICnabFieldMap,
  value: any,
) {
  const field = validateCnabMappedField(registro, mapField);
  registro.fields[field].value = value;
}

/**
 * Get value of Registro's CnabField using mapped key
 */
export function getCnabMappedValue(
  registro: CnabRegistro,
  mapField: keyof ICnabFieldMap,
): any {
  const field = validateCnabMappedField(registro, mapField);
  return registro.fields[field].value;
}

function validateCnabMappedField(
  registro: CnabRegistro,
  field: keyof ICnabFieldMap,
): string {
  const mapFieldValue = registro.fieldMap?.[field] || '';
  const fieldValue = registro.fields?.[mapFieldValue];
  if (!mapFieldValue) {
    throw new Exception('Cnab file should not have any unmapped Registro.');
  } else if (!fieldValue) {
    throw new Error(
      `Mapped field '${field}: ${mapFieldValue}}, it does not exists in fields: ${Object.keys(
        registro.fields,
      )}`,
    );
  }
  return mapFieldValue;
}