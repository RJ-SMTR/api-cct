import { Exception } from 'handlebars';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { Cnab } from '../../const/cnab.const';
import { CnabCodigoRegistro } from '../../enums/all/cnab-codigo-registro.enum';
import { CnabTipoInscricao } from '../../enums/all/cnab-tipo-inscricao.enum';
import { ICnabFieldMap } from '../../interfaces/cnab-all/cnab-field-map.interface';
import { CnabField, CnabFieldMetadata, CnabFields } from '../../interfaces/cnab-all/cnab-field.interface';
import { CnabFile, isCnabFile } from '../../interfaces/cnab-all/cnab-file.interface';
import { CnabLote, isCnabLote } from '../../interfaces/cnab-all/cnab-lote.interface';
import { CnabRegistro } from '../../interfaces/cnab-all/cnab-registro.interface';
import { cnabFieldToString, parseCnabField, stringifyCnabField } from './cnab-field-utils';

const sc = structuredClone;
const LOTE_REGISTRO_CODES = [
  CnabCodigoRegistro.HeaderLote,
  CnabCodigoRegistro.TrailerLote,
  CnabCodigoRegistro.DetalheSegmento,
].reduce((s, i) => [...s, String(i)], []);

export function stringifyCnabFile(cnab: CnabFile): [string, CnabFile] {
  const treatedCnab = sc(cnab);
  processCnabFile(treatedCnab);
  const registros = getCnabRegistros(treatedCnab);
  const stringRegistros: string[] = [];
  for (const registro of registros) {
    const stringRegistro = stringifyCnabRegistro(registro);
    stringRegistros.push(stringRegistro);
  }
  const cnabFormatted = getCnabFileFromCnabRegistros(registros);
  return [stringRegistros.join(Cnab.const.eol), cnabFormatted];
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
  const fieldsList = Object.values(fields);
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
      `First CnabField position start should be 1 but is ${current.pos[0]}. ` +
      `Current: ${cnabFieldToString(current)}`,
    );
  }
  if (!hasNext && !Cnab.const.layouts.includes(current.pos[1])) {
    throw new Error(
      'Last CnabField position end should be one of these values' +
      `${Cnab.const.layouts} but is ${current.pos[1]}. ` +
      `Current: ${cnabFieldToString(current)}`,
    );
  } else if (previous && current.pos[0] !== previous?.pos[1] + 1) {
    throw new Error(
      'Current start and previous end item positions ' +
      `should be both ${current.pos[0]} but are: previousEnd: ` +
      `${previous.pos[1]}, currentStart: ${current.pos[0]}. ` +
      `Current: ${cnabFieldToString(current)}`,
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
    plainRegistros.push(...getCnabRegistrosFromCnabFile(cnab));
  } else {
    throw new Exception(`Unsupported object type. ${JSON.stringify(cnab)}`);
  }
  return plainRegistros;
}

function getCnabRegistrosFromCnabFile(file: CnabFile): CnabRegistro[] {
  let registros = [
    sc(file.headerArquivo),
    ...file.lotes.reduce((l, v) => [...l, ...getCnabRegistrosFromLote(v)], []),
    sc(file.trailerArquivo),
  ];
  registros = registros.map((v, i) => getCnabRegistroWithMetadata(v, { registroIndex: i }));
  return registros;
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
    CnabCodigoRegistro.HeaderArquivo,
  );
}

function processCnabTrailerArquivo(cnab: CnabFile) {
  const registrosArq: number = getCnabRegistros(cnab).length;
  setCnabMappedValue(
    cnab.trailerArquivo,
    'registroIdField',
    CnabCodigoRegistro.TrailerArquivo,
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
    CnabCodigoRegistro.HeaderLote,
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
    CnabCodigoRegistro.TrailerLote,
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
      CnabCodigoRegistro.DetalheSegmento,
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
  const lines = cnabString.trim().replace(/\r\n/g, '\n').split('\n');

  // parse
  setParseCnabHeaderTrailerArquivo(lines, registrosDTO, file);
  file.lotes = parseCnabLotes(lines, registrosDTO);
  return file;
}

/**
 * Parse HeaderArquivo, TrailerArquivo directly to CnabRegistro
 */
function setParseCnabHeaderTrailerArquivo(lines: string[], registrosDTO: CnabRegistro[], file: CnabFile) {
  const lastIndex = registrosDTO.length - 1;
  file.headerArquivo = parseCnabRegistro(lines[0], registrosDTO[0]);
  file.trailerArquivo = parseCnabRegistro(lines[lastIndex], registrosDTO[lastIndex]);
}

function parseCnabLotes(cnabAllLines: string[], registrosDTO: CnabRegistro[]): CnabLote[] {
  // Get lotes
  const loteDTO = registrosDTO.slice(1, -1);
  const lotes: CnabLote[] = [];
  let newLote: CnabRegistro[] = [];
  for (let i = 1; i < cnabAllLines.length - 1; i++) {
    const { registroId, registroDTO } = getCnabLoteRegistroIdDTO(cnabAllLines[i], loteDTO);
    newLote.push(parseCnabRegistro(cnabAllLines[i], registroDTO));
    if (registroId === CnabCodigoRegistro.TrailerLote) {
      lotes.push({
        _metadata: { type: 'CnabLote' },
        headerLote: newLote[0],
        registros: newLote.slice(1, -1),
        trailerLote: newLote[newLote.length - 1],
      });
      newLote = [];
    }
  }
  return lotes;
}


/**
 * 
 * @param loteDTO One lote contain many registros (header, trailer, detalhes)
 * @returns 
 */
function getCnabLoteRegistroIdDTO(cnabRegistroLine: string, loteDTO: CnabRegistro[]): {
  registroId: string,
  registroDTO: CnabRegistro,
} {
  const { registroId, registroDTO } = getCnabRegistroIdDTO(cnabRegistroLine, loteDTO);
  if (registroId === CnabCodigoRegistro.DetalheSegmento) {
    return {
      registroId: registroId,
      registroDTO: getCnabDetalheDTO(cnabRegistroLine, loteDTO.slice(1, -1)),
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

function getCnabDetalheDTO(cnabRegistroLine: string, detalhesDTO: CnabRegistro[]): CnabRegistro {
  const detalheNames = detalhesDTO.reduce((l, v) => [...l, ...(
    (x = v?._metadata?.name) => x ? [x] : []
  )()], []);
  const errorJSON = JSON.stringify({ detalhes: detalheNames, cnabStringLine: cnabRegistroLine });
  for (const registroDTO of detalhesDTO) {
    try {
      const lineDetalheCode = parseCnabField(
        cnabRegistroLine,
        getCnabMappedField(registroDTO, 'detalheSegmentoCodeField')
      ).value;
      const DTODetalheCode = getCnabMappedField(registroDTO, 'detalheSegmentoCodeField').value;

      if (lineDetalheCode && DTODetalheCode === lineDetalheCode) {
        if (typeof lineDetalheCode !== 'string') {
          throw new Error(`Expected typeof detalheCode to be string but got ` +
            `${typeof lineDetalheCode}. ${errorJSON}`);
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
    _metadata: { type: 'CnabFile' },
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
        _metadata: { type: 'CnabLote' },
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

// #region other utils

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
    const logObj = JSON.stringify({ _metadata: registro._metadata, map: registro.fieldMap });
    throw new Exception(`CnabRegistro FieldMap key '${field}' not found. ${logObj}`);
  } else if (!fieldValue) {
    const logObj = JSON.stringify({ _metadata: registro._metadata, map: registro.fieldMap });
    throw new Error(
      `CnabRegistro FieldMap key '${field}' not exists in fields: ${mapFieldValue}. ${logObj}`,
    );
  }
  return mapFieldValue;
}

export function getTipoInscricao(cpfCnpj: string): CnabTipoInscricao {
  const cpfCnpjType = isCpfOrCnpj(cpfCnpj, true);
  if (cpfCnpjType === 'cpf') {
    return CnabTipoInscricao.CPF;
  } else if (cpfCnpjType === 'cnpj') {
    return CnabTipoInscricao.CNPJ;
  } else {
    throw CommonHttpException.details(
      `When getting CNAB TipoInscricao, cpfCnpj should be a valid CPF or CNPJ, but got ${cpfCnpj}`
    )
  }
}

/**
 * Return the max amount of detalhes groups, the same amount for each lote.
 * 
 * Example of detalhe gorup:
 * 
 * Each lote has N detalhe groups.
 * 
 * lote1 = [[detalheA, detalheB], [detalheA, detalheB]]
 * 
 * @param detalhesPerLote E.g. [lote1 has 2 detalhes, lote2 has 3 detalhes]
 */
export function getMaxDetalhes(detalhesPerLote: number[]): number {
  const maxRegistros = 999999;
  const startRegistros = 2; // Header/Trailer Arquivo
  const lotesRegistros = detalhesPerLote.length * 2; // Header/TrailerLote
  const fixedRegistros = startRegistros + lotesRegistros;
  const allDetalhesGroup = detalhesPerLote.reduce((s, i) => s + i, 0) || 1;
  const maxDetalhes = Math.floor((maxRegistros - fixedRegistros) / allDetalhesGroup);
  return maxDetalhes;
}

// #endregion

export function getCnabRegistroWithMetadata(
  registro: CnabRegistro,
  metadata?: CnabFieldMetadata,
): CnabRegistro {
  for (const key of Object.keys(registro.fields)) {
    registro.fields[key]._metadata = {
      name: metadata?.name || registro.fields[key]._metadata?.name,
      registro: metadata?.registro || registro.fields[key]._metadata?.registro,
      cnab: metadata?.cnab || registro.fields[key]._metadata?.cnab,
      registroIndex: metadata?.registroIndex === undefined
        ? registro.fields[key]._metadata?.registroIndex
        : metadata.registroIndex,
    }
  }
  return registro;
}

export function getCnabFieldsWithMetadata(
  fields: CnabFields,
  registroName: string,
  cnabName?: string,
  loteNumber?: number,
): CnabFields {
  for (const key of Object.keys(fields)) {
    fields[key]._metadata = {
      name: key,
      registro: registroName,
      cnab: cnabName || fields[key]._metadata?.cnab,
      registroIndex: loteNumber || fields[key]._metadata?.registroIndex,
    }
  }
  return fields;
}
