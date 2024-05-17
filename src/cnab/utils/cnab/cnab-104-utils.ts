import { CnabCodigoSegmento } from 'src/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabField } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';
import { CnabFile104 } from '../../interfaces/cnab-240/104/cnab-file-104.interface';
import { CnabHeaderArquivo104 } from '../../interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabLote104 } from '../../interfaces/cnab-240/104/cnab-lote-104.interface';
import { CnabRegistros104 } from '../../interfaces/cnab-240/104/cnab-registros-104.interface';
import { CnabTrailerArquivo104 } from '../../interfaces/cnab-240/104/cnab-trailer-arquivo-104.interface';
import { CnabTrailerLote104 } from '../../interfaces/cnab-240/104/cnab-trailer-lote-104.interface';
import { CnabFile104Extrato } from '../../interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { CnabFile104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { CnabHeaderLote104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabFile } from '../../interfaces/cnab-all/cnab-file.interface';
import { CnabLote } from '../../interfaces/cnab-all/cnab-lote.interface';
import { CnabRegistro } from '../../interfaces/cnab-all/cnab-registro.interface';
import { cnab104ExtratoTemplates } from '../../templates/cnab-240/104/extrato/cnab-104-extrato-templates.const';
import { Cnab104PgtoTemplates as PgtoTemplates } from '../../templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getCnabFileFrom104 } from './cnab-104-pipe-utils';
import { getCnabNumber, getPictureNumberSize } from './cnab-field-utils';
import { setCnabFileMetadata } from './cnab-metadata-utils';
import {
  getCnabMappedValue,
  parseCnabFile,
  processCnabFile,
  removeCnabDetalheZ,
  stringifyCnabFile,
} from './cnab-utils';

const sc = structuredClone;

export function parseCnab240Extrato(cnabString: string): CnabFile104Extrato {
  const fileDTO = sc(cnab104ExtratoTemplates.file.dto.retorno);
  const file = parseCnabFile(cnabString, fileDTO);
  const file104 = getCnab104FromFile(file);
  return file104 as CnabFile104Extrato;
}

export function parseCnab240Pagamento(cnabString: string): CnabFile104Pgto {
  const processedCnabString = removeCnabDetalheZ(cnabString);
  const fileDTO = sc(PgtoTemplates.file.dto.retorno);
  const file = parseCnabFile(processedCnabString, fileDTO);
  const file104 = getCnab104FromFile(file);
  return file104 as CnabFile104Pgto;
}

/**
 * Validate, process and transform raw cnab into string
 */
export function stringifyCnab104File<T extends CnabFile104>(
  cnab104: T,
  process = true,
  cnabName?: string,
): [string, T] {
  const _cnab104 = process ? getProcessedCnab104(cnab104, cnabName) : cnab104;
  const cnab = getCnabFileFrom104(_cnab104);
  const [cnabString, cnabFormatted] = stringifyCnabFile(cnab);
  const cnab104Formatted = getCnab104FromFile(cnabFormatted);
  return [cnabString, cnab104Formatted as T];
}

/**
 * Validate, and add Cnab 104 information, including debug metadata
 *
 * @param cnabName CnabName for debugging
 */
export function getProcessedCnab104<T extends CnabFile104>(
  cnab104: T,
  cnabName?: string,
): T {
  validateCnab104File(cnab104);
  const newCnab104 = structuredClone(cnab104);
  setCnabFileMetadata(newCnab104, cnabName);
  processCnab104File(newCnab104);
  const cnab = getCnabFileFrom104(newCnab104);
  processCnabFile(cnab);
  return getCnab104FromFile(cnab) as T;
}

export function validateCnab104File(cnab: CnabFile104) {
  validateUniqueCnab104Lotes(cnab.lotes);
}

export function validateUniqueCnab104Lotes(lotes: CnabLote104[]) {
  const loteTypesDict = lotes.reduce(
    (l, i) => [
      ...l,
      {
        // ICnab240_104HeaderLotePgto
        ...('tipoCompromisso' in i.headerLote
          ? { tipoCompromisso: i.headerLote.tipoCompromisso.value }
          : {}),
        formaLancamento: i.headerLote.formaLancamento.value,
      },
    ],
    [],
  );
  const loteTypes = lotes.reduce(
    (l, i) => [
      ...l,
      `${i.headerLote.formaLancamento.value}|` +
        `${i.headerLote?.['tipoCompromisso']?.value}`, // ICnab240_104HeaderLotePgto only
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
export function processCnab104File(cnab: CnabFile104) {
  processCnab104Lotes(cnab.lotes);
}

function processCnab104Lotes(lotes: CnabLote104[]) {
  for (let i = 0; i < lotes.length; i++) {
    processCnab104TrailerLote(lotes[i]);
  }
}

function processCnab104TrailerLote(lote: CnabLote104) {
  const somatorioValores = getSomarioValoresCnabLote(
    lote,
    lote.trailerLote.somatorioValores,
  );
  lote.trailerLote.somatorioValores.value = somatorioValores;
}

function getSomarioValoresCnabLote(
  lote: CnabLote104,
  somatorioField: CnabField,
): number {
  const sum = lote.registros.reduce((s2, regGroup) => {
    const valorLancamento = regGroup.detalheA?.valorLancamento;
    let value = 0;
    if (valorLancamento) {
      value = getCnabNumber(valorLancamento);
    }
    return s2 + value;
  }, 0);

  const { decimal } = getPictureNumberSize(somatorioField.picture);
  return Number(sum.toFixed(decimal));
}

// #region getCnab104FromFile

/**
 * A pipe that transforms Cnab240_104File into CnabFile
 */
export function getCnab104FromFile(cnab: CnabFile): CnabFile104 {
  return {
    _metadata: { type: 'CnabFile104', extends: cnab._metadata.type },
    headerArquivo: cnab.headerArquivo.fields as unknown as CnabHeaderArquivo104,
    lotes: getCnab104Lotes(cnab.lotes),
    trailerArquivo: cnab.trailerArquivo
      .fields as unknown as CnabTrailerArquivo104,
  };
}

function getCnab104Lotes(lotes: CnabLote[]): CnabLote104[] {
  const newLotes: CnabLote104[] = [];
  for (const lote of lotes) {
    newLotes.push({
      headerLote: lote.headerLote.fields as unknown as CnabHeaderLote104Pgto,
      registros: getCnab104Registros(lote),
      trailerLote: lote.trailerLote.fields as unknown as CnabTrailerLote104,
    });
  }
  return newLotes;
}

/**
 * From list of CnabLote return a list of Detalhes.
 *
 * For example: We have input of `[detalheA, deatalheB, detalheA, deatalheB]`,
 * it returns `[{detalheA: {...}, detalheB: {...}}, {detalheA: {...}, detalheB: {...}}]`
 *
 * @param lote Lote containing Header and Trailer
 */
function getCnab104Registros(lote: CnabLote): CnabRegistros104[] {
  const newRegistros: CnabRegistros104[] = [];
  let newRegistro: CnabRegistros104 = {};

  // Add detalhe
  for (const detalhe of lote.registros) {
    // reset / push new registro set
    if (isCnabRegistroNewLote(detalhe)) {
      if (Object.values(newRegistro).some((i) => i)) {
        newRegistros.push(newRegistro);
      }
      newRegistro = {};
    }
    // add detalhe to registro set
    const codSegmento = getCnabMappedValue(detalhe, 'detalheSegmentoCodeField');
    newRegistro[`detalhe${codSegmento}`] = detalhe.fields;
  }

  // push new registro set
  if (Object.values(newRegistro).some((i) => i)) {
    newRegistros.push(newRegistro);
  }

  return newRegistros;
}

/**
 * If CnabRegisto represents a new lote.
 *
 * In Cnab104 we have interface Registro = { detalheA: {...}, detalheB: {...} }.
 * So we expect to transform each CnabRegistro into a list of of sets (detalheA, detalheB).
 *
 * There are other combinations but for now we just need to deal with these.
 */
function isCnabRegistroNewLote(registro: CnabRegistro): boolean {
  return [CnabCodigoSegmento.A, CnabCodigoSegmento.E].includes(
    getCnabMappedValue(registro, 'detalheSegmentoCodeField'),
  );
}

// #endregion
