import { Cnab104CodigoSegmento } from '../enums/104/cnab-104-codigo-segmento.enum';
import { ICnab240_104File } from '../interfaces/cnab-240/104/cnab-240-104-file.interface';
import { ICnab240_104HeaderArquivo } from '../interfaces/cnab-240/104/cnab-240-104-header-arquivo.interface';
import { ICnab240_104HeaderLote } from '../interfaces/cnab-240/104/cnab-240-104-header-lote.interface';
import { ICnab240_104Lote } from '../interfaces/cnab-240/104/cnab-240-104-lote.interface';
import { ICnab240_104Registro } from '../interfaces/cnab-240/104/cnab-240-104-registro.interface';
import { ICnab240_104TrailerArquivo } from '../interfaces/cnab-240/104/cnab-240-104-trailer-arquivo.interface';
import { ICnab240_104TrailerLote } from '../interfaces/cnab-240/104/cnab-240-104-trailer-lote.interface';
import { cnab240_104DetalheATemplate } from '../templates/cnab-240/104/cnab-240-104-detalhe-a-template.const';
import { cnab240_104DetalheBTemplate } from '../templates/cnab-240/104/cnab-240-104-detalhe-b-template.const';
import { cnab240_104HeaderArquivoTemplate } from '../templates/cnab-240/104/cnab-240-104-header-arquivo-template.const';
import { cnab240_104HeaderLoteTemplate } from '../templates/cnab-240/104/cnab-240-104-header-lote-template.const';
import { cnab240_104TrailerArquivoTemplate } from '../templates/cnab-240/104/cnab-240-104-trailer-arquivo-template.const';
import { cnab240_104TrailerLoteTemplate } from '../templates/cnab-240/104/cnab-240-104-trailer-lote-template.const';
import { cnabAll104FieldMapTemplate as fieldMapTemplate } from '../templates/cnab-all/cnab-all-104-registro-field-map-template';
import { CnabFields } from '../types/cnab-field.type';
import { CnabFile } from '../types/cnab-file.type';
import { CnabLote } from '../types/cnab-lote.type';
import { CnabRegistro } from '../types/cnab-registro.type';
import {
  getCnabMappedValue,
  parseCnabFile,
  processCnabFile,
  stringifyCnabFile,
} from './cnab-utils';

export function parseCnab240_104(cnabString: string): ICnab240_104File {
  const fileDTO = getCnabFileFrom104({
    headerArquivo: structuredClone(cnab240_104HeaderArquivoTemplate),
    lotes: [{
      headerLote: structuredClone(cnab240_104HeaderLoteTemplate),
      registros: [{
        detalheA: structuredClone(cnab240_104DetalheATemplate),
        detalheB: structuredClone(cnab240_104DetalheBTemplate),
      }],
      trailerLote: structuredClone(cnab240_104TrailerLoteTemplate),
    }],
    trailerArquivo: structuredClone(cnab240_104TrailerArquivoTemplate),
  })
  const file = parseCnabFile(cnabString, fileDTO);
  return getCnab104FromFile(file);
}

/**
 * Validate and add Cnab 104 information
 */
export function getProcessedCnab104(
  cnab104: ICnab240_104File,
): ICnab240_104File {
  validateCnab104File(cnab104);
  const newCnab104 = structuredClone(cnab104);
  processCnab104File(newCnab104);
  const cnab = getCnabFileFrom104(newCnab104);
  processCnabFile(cnab);
  return getCnab104FromFile(cnab);
}

/**
 * Validate, process and transform into string
 */
export function stringifyCnab104File(cnab104: ICnab240_104File): string {
  validateCnab104File(cnab104);
  const newCnab104 = structuredClone(cnab104);
  processCnab104File(newCnab104);
  const cnab = getCnabFileFrom104(newCnab104);
  return stringifyCnabFile(cnab);
}

export function validateCnab104File(cnab: ICnab240_104File) {
  validateUniqueCnab104Lotes(cnab.lotes);
}

export function validateUniqueCnab104Lotes(lotes: ICnab240_104Lote[]) {
  const loteTypesDict = lotes.reduce(
    (l, i) => [
      ...l,
      {
        tipoCompromisso: i.headerLote.tipoCompromisso.value,
        formaLancamento: i.headerLote.formaLancamento.value,
      },
    ],
    [],
  );
  const loteTypes = lotes.reduce(
    (l, i) => [
      ...l,
      String(i.headerLote.tipoCompromisso.value) +
      String(i.headerLote.formaLancamento.value),
    ],
    [],
  );
  const uniqueLoteTypes = [...new Set(loteTypes)];
  if (loteTypes.length !== uniqueLoteTypes.length) {
    throw new Error(
      'Each headerLote must have unique combination of ' +
      "`tipoCompromisso` and 'formaLancamento' but there are repeated ones " +
      `(${JSON.stringify(loteTypesDict)})`,
    );
  }
}

/**
 * Process data in CnabFile for Caixa (bank 104)
 */
export function processCnab104File(cnab: ICnab240_104File) {
  processCnab104Lotes(cnab.lotes);
}

function processCnab104Lotes(lotes: ICnab240_104Lote[]) {
  for (let i = 0; i < lotes.length; i++) {
    processCnab104TrailerLote(lotes[i]);
  }
}

function processCnab104TrailerLote(lote: ICnab240_104Lote) {
  const somatorioValores = getSomarioValoresCnabLote(lote);
  lote.trailerLote.somatorioValores.value = somatorioValores;
}

function getSomarioValoresCnabLote(lote: ICnab240_104Lote): number {
  return lote.registros.reduce(
    (s2, regGroup) =>
      s2 + Number(regGroup.detalheA?.valorLancamento?.value || 0),
    0,
  );
}

// #region getCnab104FromFile

export function getCnab104FromFile(cnab: CnabFile): ICnab240_104File {
  return {
    headerArquivo: (cnab.headerArquivo.fields as unknown as ICnab240_104HeaderArquivo),
    lotes: getCnab104Lotes(cnab.lotes),
    trailerArquivo: (cnab.trailerArquivo.fields as unknown as ICnab240_104TrailerArquivo),
  };
}

function getCnab104Lotes(lotes: CnabLote[]): ICnab240_104Lote[] {
  const newLotes: ICnab240_104Lote[] = [];
  for (const lote of lotes) {
    newLotes.push({
      headerLote: (lote.headerLote.fields as unknown as ICnab240_104HeaderLote),
      registros: getCnab104Registros(lote),
      trailerLote: (lote.trailerLote.fields as unknown as ICnab240_104TrailerLote),
    });
  }
  return newLotes;
}

/**
 * From list of CnabLote return a list of sets of Detalhes.
 *
 * For example: We have input of `[detalheA, deatalheB, detalheA, deatalheB]`,
 * it returns `[{detalheA: {...}, detalheB: {...}}, {detalheA: {...}, detalheB: {...}}]`
 */
function getCnab104Registros(lote: CnabLote): ICnab240_104Registro[] {
  const newRegistros: ICnab240_104Registro[] = [];
  let newRegistro: ICnab240_104Registro = {};
  for (const registro of lote.registros) {
    // reset / push new registro set
    if (isNewCnab104RegistroSet(registro)) {
      if (Object.values(newRegistro).some((i) => i)) {
        newRegistros.push(newRegistro);
      }
      newRegistro = {};
    }
    // add detalhe to registro set
    const codSegmento = getCnabMappedValue(
      registro,
      'detalheSegmentoCodeField',
    );
    newRegistro[`detalhe${codSegmento}`] = registro.fields;
  }
  // push new registro set
  if (Object.values(newRegistro).some((i) => i)) {
    newRegistros.push(newRegistro);
  }

  return newRegistros;
}

/**
 * Each registro follows this order: A,B,A,B...
 * There is no "B,A", "A,A" or "B,B", for example.
 *
 * In Cnab104 we have interface Registro = { detalheA: {...}, detalheB: {...} }.
 * So we expect to transform each CnabRegistro into a list of of sets (detalheA, detalheB).
 *
 * There are other combinations but for now we just need to deal with these.
 */
function isNewCnab104RegistroSet(registro: CnabRegistro): boolean {
  return [Cnab104CodigoSegmento.A].includes(
    getCnabMappedValue(registro, 'detalheSegmentoCodeField'),
  );
}

// #endregion

export function getCnabFileFrom104(cnab: ICnab240_104File): CnabFile {
  return {
    headerArquivo: {
      fields: (cnab.headerArquivo as unknown as CnabFields),
      fieldMap: fieldMapTemplate.headerArquivo,
    },
    lotes: getCnabLotesFrom104(cnab.lotes),
    trailerArquivo: {
      fields: (cnab.trailerArquivo as unknown as CnabFields),
      fieldMap: fieldMapTemplate.trailerArquivo,
    },
  };
}

function getCnabLotesFrom104(lotes: ICnab240_104Lote[]): CnabLote[] {
  return lotes.reduce((l, i) => [...l, getCnabLoteFrom104(i)], []);
}

function getCnabLoteFrom104(lote: ICnab240_104Lote): CnabLote {
  return {
    headerLote: {
      fields: (lote.headerLote as unknown as CnabFields),
      fieldMap: fieldMapTemplate.headerLote,
    },
    registros: getCnabRegistrosFrom104(lote.registros),
    trailerLote: {
      fields: (lote.trailerLote as unknown as CnabFields),
      fieldMap: fieldMapTemplate.trailerLote,
    },
  };
}

function getCnabRegistrosFrom104(
  registrosGroup: ICnab240_104Registro[],
): CnabRegistro[] {
  const baseRegistros: CnabRegistro[] = [];
  for (const registros of registrosGroup) {
    for (const registro of Object.values(registros).filter((i) => i)) {
      const baseRegistro: CnabRegistro = {
        fields: registro,
        fieldMap: fieldMapTemplate.detalheLote,
      };
      baseRegistros.push(baseRegistro);
    }
  }
  return baseRegistros;
}
