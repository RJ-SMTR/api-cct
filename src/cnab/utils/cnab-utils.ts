import { Exception } from 'handlebars';
import { CNAB_EOL, CNAB_SUPPORTED_FORMATS } from '../cnab-consts';
import { CnabAllCodigoRegistro } from '../enums/all/cnab-all-codigo-registro.enum';
import { ICnabFieldMap } from '../interfaces/cnab-all/cnab-field-map.interface';
import { CnabField, CnabFields } from '../types/cnab-field.type';
import { CnabFile, isCnabFile } from '../types/cnab-file.type';
import { CnabLote, isCnabLote } from '../types/cnab-lote.type';
import { CnabRegistro } from '../types/cnab-registro.type';
import { parseCnabField, stringifyCnabField } from './cnab-field-utils';

const sc = structuredClone;
const LOTE_REGISTRO_CODES = [
  CnabAllCodigoRegistro.HeaderLote,
  CnabAllCodigoRegistro.TrailerLote,
  CnabAllCodigoRegistro.DetalheSegmento,
].reduce((s, i) => [...s, String(i)], []);

export function stringifyCnabFile(cnab: CnabFile): string {
  const treatedCnab = sc(cnab);
  processCnabFile(treatedCnab);
  return getCnabRegistros(treatedCnab)
    .reduce((l, i) => [...l, stringifyCnabRegistro(i)], [])
    .join(CNAB_EOL);
}

/**
 * Validate and stringify Registro
 */
export function stringifyCnabRegistro(registro: CnabRegistro): string {
  validateCnabRegistro(registro);
  return getSortedCnabFieldList(registro.fields).reduce(
    (s, i) => s + stringifyCnabField(i),
    '',
  );
}

/**
 * Get CnabField list sorted ascending by position, from CnabRegistro
 */
export function getSortedCnabFieldList(fields: CnabFields): CnabField[] {
  const fieldsList = Object.values(fields.fields);
  fieldsList.sort((a, b) => a.pos[0] - b.pos[0]);
  return fieldsList;
}

/**
 * Get CnabField list sorted ascending by position, from CnabRegistro
 */
export function getSortedCnabCnabFields(fields: CnabFields): CnabFields {
  const entries = Object.entries(fields);
  entries.sort(([, v1], [, v2]) => v1.pos[0] - v2.pos[0]);
  const newFields: CnabFields = {};
  for (const [key, value] of entries) {
    newFields[key] = value;
  }
  return newFields;
}

// #region validateCnabRegistro

/**
 * Run all validations of CnabRegistro
 */
export function validateCnabRegistro(registro: CnabRegistro) {
  const fields = getSortedCnabFieldList(registro.fields);
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

// #endregion

// #region getCnabRegistros

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
    sc(file.headerArquivo),
    ...file.lotes.reduce((l, i) => [...l, ...getCnabRegistrosFromLote(i)], []),
    sc(file.trailerArquivo),
  ];
}

function getCnabRegistrosFromLote(lote: CnabLote): CnabRegistro[] {
  return [sc(lote.headerLote), ...sc(lote.registros), sc(lote.trailerLote)];
}

// #endregion

// #region processCnabFile

/**
 * Process data in CnabFile, like sums, countings etc
 */
export function processCnabFile(cnab: CnabFile) {
  processCnabHeaderArquivo(cnab);
  processCnabLotes(cnab.lotes);
  processCnabTrailerArquivo(cnab);
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

// #endregion

// #region parseCnabFile

/**
 * @param cnabString Entire Cnab content as string
 * @param fileDTO It must have a single Lote with every Detalhe possible.
 * 
 * fileDTO example:
 * ```
 * {
 *  --headerArquivo,
 *  ----lotes: [
 *  ------{
 *  --------headerLote,
 *  --------registros: [ detalheADTO, detalheBDTO ],
 *  --------trailerLote,
 *  ------}
 *  ----],
 *  --trailerArquivo,
 * }
 * ``` 
 */
export function parseCnabFile(cnabString: string, fileDTO: CnabFile): CnabFile {
  // get valid data
  const file = sc(fileDTO);
  const registrosDTO = getCnabRegistrosFromCnabFile(file);
  const lines = cnabString.replace(/\r\n/g, '\n').split('\n');

  // parse
  setParseCnabHeaderTrailerArquivo(lines, registrosDTO);
  file.lotes = parseCnabLotes(lines, registrosDTO);
  return file;
}

function setParseCnabHeaderTrailerArquivo(lines: string[], registros: CnabRegistro[]) {
  const lastIndex = registros.length - 1;
  registros[0] = parseCnabRegistro(lines[0], registros[0]);
  registros[lastIndex] = parseCnabRegistro(lines[lastIndex], registros[lastIndex]);
}

function parseCnabLotes(cnabAllLines: string[], registrosDTO: CnabRegistro[]): CnabLote[] {
  // Get lotes
  const loteDTO = registrosDTO.slice(1, -1);
  const cnabLotes: CnabLote[] = [];
  const lote: CnabRegistro[] = [];
  for (let i = 1; i < cnabAllLines.length - 1; i++) {
    const { registroId, registroDTO } = getCnabLoteRegistroIdDTO(cnabAllLines[i], loteDTO);
    lote.push(parseCnabRegistro(cnabAllLines[i], registroDTO));
    if (registroId === CnabAllCodigoRegistro.TrailerLote) {
      cnabLotes.push({
        headerLote: lote[0],
        registros: lote.slice(1, -1),
        trailerLote: lote[lote.length - 1],
      })
    }
  }
  return cnabLotes;
}


function getCnabLoteRegistroIdDTO(cnabRegistroLine: string, loteDTO: CnabRegistro[]): {
  registroId: string,
  registroDTO: CnabRegistro,
} {
  const { registroId, registroDTO } = getCnabRegistroIdDTO(cnabRegistroLine, loteDTO);
  if (registroId === CnabAllCodigoRegistro.DetalheSegmento) {
    return {
      registroId: registroId,
      registroDTO: getCnabDetalheDTO(cnabRegistroLine, loteDTO),
    };
  } else {
    return {
      registroId: registroId,
      registroDTO: registroDTO,
    };
  }
}

function getCnabRegistroIdDTO(cnabRegistroLine: string, loteDTO: CnabRegistro[]): {
  registroDTO: CnabRegistro,
  registroId: string,
} {
  const errorJSON = JSON.stringify({ cnabStringLine: cnabRegistroLine });
  for (const registroDTO of loteDTO) {
    try {
      const registroId = parseCnabField(
        cnabRegistroLine,
        getCnabMappedField(registroDTO, 'registroIdField')
      ).value;
      if (registroId && !isNaN(registroId)) {
        if (!LOTE_REGISTRO_CODES.includes(registroId)) {
          throw new Error(`Expected registroId to be any of [${LOTE_REGISTRO_CODES}], ` +
            `but got ${registroId}. ${errorJSON}`)
        }
        return {
          registroDTO: registroDTO,
          registroId: registroId,
        };
      }
    } catch { }
  }
  throw new Error(`No registroId found. ${errorJSON}`);
}

function getCnabDetalheDTO(cnabRegistroLine: string, detalheDTO: CnabRegistro[]): CnabRegistro {
  const errorJSON = JSON.stringify({ detalheDTO, cnabStringLine: cnabRegistroLine });
  for (const registroDTO of detalheDTO) {
    try {
      const detalheCode = parseCnabField(
        cnabRegistroLine,
        getCnabMappedField(registroDTO, 'detalheSegmentoCodeField')
      ).value;
      if (detalheCode) {
        if (typeof detalheCode !== 'string') {
          throw new Error(`Expected typeof detalheCode to be string but got ` +
            `${typeof detalheCode}. ${errorJSON}`);
        }
        return registroDTO;
      }
    } catch { }
  }
  throw new Error(`No detalheCode found. ${errorJSON}`);
}

export function getCnabFileFromCnabRegistros(registros: CnabRegistro[]): CnabFile {
  validateCnabRegistrosSizeToCnabFile(registros);
  return {
    headerArquivo: registros[0],
    lotes: getCnabLotesFromCnabRegistros(registros.slice(1, -1)),
    trailerArquivo: registros[registros.length - 1],
  }
}

/**
 * @param registros Slice with only lotes
 */
export function getCnabLotesFromCnabRegistros(registros: CnabRegistro[]): CnabLote[] {
  const lotes: CnabLote[] = [];
  let newLoteSlice: CnabRegistro[] = [];
  for (const registro of registros) {
    newLoteSlice.push(registro);
    if (Number(getCnabMappedValue(registro, 'registroIdField')) === 5) {
      lotes.push({
        headerLote: newLoteSlice[0],
        registros: newLoteSlice.slice(1, -1),
        trailerLote: newLoteSlice[newLoteSlice.length - 1],
      })
      newLoteSlice = [];
    }
  }
  return lotes;
}

/**
 * Minimum size for a valid generic CNAB file:
 * - 1x headerArquivo, 1x trailerArquivo,
 * - 1x headerLote, 1x trailerLote,
 * - 1x detalhe
 */
export function validateCnabRegistrosSizeToCnabFile(registros: CnabRegistro[]) {
  const MIN_CNAB_FILE_SIZE = 5;
  if (registros.length < 5) {
    throw new Error(
      `Minimum CnabRegistro list size for CnabFile is ${MIN_CNAB_FILE_SIZE}, `
      + `got ${registros.length}.`
    )
  }
}

// export function validateParseCnabRegistros(registros: CnabRegistro[], lines: string[]) {
//   if (registros.length !== lines.length) {
//     throw new Error(
//       `Registros length (${registros.length}) is different from ` +
//       `lines length (${lines.length})`
//     );
//   }
// }

// #endregion

// #region parseCnabRegistro

/**
 * Read string to CnabRegistro and validate.
 * @param registroDTO It will know the positions, type then validate against DTO
 */
export function parseCnabRegistro(cnabRegistroLine: string, registroDTO: CnabRegistro): CnabRegistro {
  const registro = getCnabRegistroFromStringLine(cnabRegistroLine, registroDTO);
  validateCnabRegistro(registro);
  return registro;
}

/**
 * From CNAB string line (i.e. CnabRegistro in string format),
 * convert to CnabRegistro Object
 */
export function getCnabRegistroFromStringLine(cnabStringLine: string, registroDTO: CnabRegistro): CnabRegistro {
  const registro: CnabRegistro = sc(registroDTO);
  for (const key of Object.keys(registro.fields)) {
    registro.fields[key] = parseCnabField(cnabStringLine, registro.fields[key]);
  }
  return registro;
}

// #endregion

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
 * Get CnabField of CnabRegistro mapped key
 */
export function getCnabMappedField(
  registro: CnabRegistro,
  mapField: keyof ICnabFieldMap,
): CnabField {
  const field = validateCnabMappedField(registro, mapField);
  return registro.fields[field];
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
