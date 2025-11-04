import { CnabFile104 } from '../../interfaces/cnab-240/104/cnab-file-104.interface';
import {
  CnabField,
  CnabFields,
} from '../../interfaces/cnab-all/cnab-field.interface';
import { CnabFileBase } from '../../types/cnab/cnab-file-base.type';

const addMeta = addCnabTemplateMetadata;

/**
 * Set metadata to all CnabRegistro, CnabFields in CnabFile.
 */
export function setCnabFileMetadata(cnab: CnabFileBase, cnabName?: string) {
  cnab.headerArquivo = addMeta(cnab.headerArquivo, 'headerArquivo', cnabName);
  for (const i in cnab.lotes) {
    const lote = cnab.lotes[i];
    lote.headerLote = addMeta(
      lote.headerLote,
      'headerLote',
      cnabName,
      Number(i),
    );
    for (const registro of lote.registros) {
      for (const detalheName of Object.keys(registro)) {
        const detalhe = registro[detalheName];
        registro[detalheName] = addMeta(
          detalhe,
          detalheName,
          cnabName,
          Number(i),
        );
      }
    }
    lote.trailerLote = addMeta(
      lote.trailerLote,
      'trailerLote',
      cnabName,
      Number(i),
    );
  }
  cnab.trailerArquivo = addMeta(
    cnab.trailerArquivo,
    'trailerArquivo',
    cnabName,
  );
}

export function setCnab104Metadata(cnab: CnabFile104, cnabName?: string) {
  cnab.headerArquivo = addMeta(cnab.headerArquivo, 'headerArquivo', cnabName);
  for (const i in cnab.lotes) {
    const lote = cnab.lotes[i];
    lote.headerLote = addMeta(
      lote.headerLote,
      'headerLote',
      cnabName,
      Number(i),
    );
    for (const registro of lote.registros) {
      registro.detalheA = addMeta(
        registro.detalheA,
        'detalheA',
        cnabName,
        Number(i),
      );
      registro.detalheB = addMeta(
        registro.detalheB,
        'detalheB',
        cnabName,
        Number(i),
      );
      registro.detalheE = addMeta(
        registro.detalheE,
        'detalheE',
        cnabName,
        Number(i),
      );
    }
    lote.trailerLote = addMeta(
      lote.trailerLote,
      'trailerLote',
      cnabName,
      Number(i),
    );
  }
  cnab.trailerArquivo = addMeta(
    cnab.trailerArquivo,
    'trailerArquivo',
    cnabName,
  );
}

/**
 * Add Metadata to Cnab Template (CnabField)
 */
export function addCnabTemplateMetadata<T>(
  fields: T,
  registroName: string,
  cnabName?: string,
  loteNumber?: number,
): T {
  if (fields === undefined) {
    return fields;
  }
  const _fields = fields as CnabFields;
  for (const key of Object.keys(_fields)) {
    _fields[key]._metadata = {
      name: key,
      registro: registroName,
      cnab: cnabName || _fields[key]._metadata?.cnab,
      registroIndex: loteNumber || _fields[key]._metadata?.registroIndex,
    };
  }
  return fields;
}

export function getCnabFieldNameLog(field: CnabField) {
  const cnabName = field._metadata?.cnab || '';
  const regName = (x = field._metadata?.registro) => (x ? `.${x}` : '');
  const fieldName = (x = field._metadata?.name) => (x ? `.${x}` : '');
  return cnabName + regName() + fieldName();
}
