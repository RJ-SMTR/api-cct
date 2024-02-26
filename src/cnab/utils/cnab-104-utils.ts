import { ICnab240_104File } from '../interfaces/cnab-240/104/cnab-240-104-file.interface';
import { ICnab240_104Lote } from '../interfaces/cnab-240/104/cnab-240-104-lote.interface';
import { ICnab240_104Registro } from '../interfaces/cnab-240/104/cnab-240-104-registro.interface';
import { cnabAll104FieldMapTemplate as fieldMapTemplate } from '../templates/cnab-all/cnab-all-104-registro-field-map-template';
import { CnabFile } from '../types/cnab-file.type';
import { CnabLote } from '../types/cnab-lote.type';
import { CnabRegistro } from '../types/cnab-registro.type';
import { stringifyCnabFile } from './cnab-utils';

export function stringifyCnab104File(cnab104: ICnab240_104File): string {
  const newCnab104 = structuredClone(cnab104);
  processCnab104File(newCnab104);
  const cnab = getCnabFileFrom104(newCnab104);
  return stringifyCnabFile(cnab);
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

export function getCnabFileFrom104(cnab: ICnab240_104File): CnabFile {
  return {
    headerArquivo: {
      fields: cnab.headerArquivo,
      fieldMap: fieldMapTemplate.headerArquivo,
    },
    lotes: getCnabLotesFrom104(cnab.lotes),
    trailerArquivo: {
      fields: cnab.trailerArquivo,
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
      fields: lote.headerLote,
      fieldMap: fieldMapTemplate.headerLote,
    },
    registros: getCnabRegistrosFrom104(lote.registros),
    trailerLote: {
      fields: lote.trailerLote,
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
