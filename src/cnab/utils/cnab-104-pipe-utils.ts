import { CnabFile104 } from "../interfaces/cnab-240/104/cnab-file-104.interface";
import { CnabLote104 } from "../interfaces/cnab-240/104/cnab-lote-104.interface";
import { CnabRegistros104 } from "../interfaces/cnab-240/104/cnab-registros-104.interface";
import { cnab104FieldMapTemplate as fieldMapTemplate } from '../templates/cnab-all/cnab-104-field-map-template';
import { CnabFields } from "../interfaces/cnab-field.interface";
import { CnabFile } from "../interfaces/cnab-file.interface";
import { CnabLote } from "../interfaces/cnab-lote.interface";
import { CnabRegistro } from "../interfaces/cnab-registro.interface";

export function getCnabFileFrom104(cnab: CnabFile104): CnabFile {
  return {
    _metadata: { type: 'CnabFile', extends: cnab?._metadata?.type },
    headerArquivo: {
      _metadata: { name: 'headerArquivo', type: 'CnabRegistro' },
      fields: (cnab.headerArquivo as unknown as CnabFields),
      fieldMap: fieldMapTemplate.headerArquivo,
    },
    lotes: getCnabLotesFrom104(cnab.lotes),
    trailerArquivo: {
      _metadata: { name: 'trailerArquivo', type: 'CnabRegistro' },
      fields: (cnab.trailerArquivo as unknown as CnabFields),
      fieldMap: fieldMapTemplate.trailerArquivo,
    },
  };
}

function getCnabLotesFrom104(lotes: CnabLote104[]): CnabLote[] {
  return lotes.reduce((l, i) => [...l, getCnabLoteFrom104(i)], []);
}

function getCnabLoteFrom104(lote: CnabLote104): CnabLote {
  return {
    _metadata: { type: 'CnabLote' },
    headerLote: {
      _metadata: { type: 'CnabRegistro', name: 'headerLote' },
      fields: (lote.headerLote as unknown as CnabFields),
      fieldMap: fieldMapTemplate.headerLote,
    },
    registros: getCnabRegistrosFrom104(lote.registros),
    trailerLote: {
      _metadata: { type: 'CnabRegistro', name: 'trailerLote' },
      fields: (lote.trailerLote as unknown as CnabFields),
      fieldMap: fieldMapTemplate.trailerLote,
    },
  };
}

function getCnabRegistrosFrom104(
  registrosGroup: CnabRegistros104[],
): CnabRegistro[] {
  const baseRegistros: CnabRegistro[] = [];
  for (const registros of registrosGroup) {
    for (const [name, registro] of Object.entries(registros).filter(([, r]) => r)) {
      const baseRegistro: CnabRegistro = {
        _metadata: { type: 'CnabRegistro', name: name },
        fields: registro,
        fieldMap: fieldMapTemplate.detalheLote,
      };
      baseRegistros.push(baseRegistro);
    }
  }
  return baseRegistros;
}