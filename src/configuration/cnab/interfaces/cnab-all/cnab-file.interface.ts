import { MetadataAs } from 'src/utils/interfaces/metadata.type';
import { CnabLote } from './cnab-lote.interface';
import { CnabRegistro } from './cnab-registro.interface';

export interface CnabFile {
  _metadata: MetadataAs<{ type: 'CnabFile' }>
  /** E.g. CnabFile represents CnabFile104Extrato */
  _represents?: string,
  headerArquivo: CnabRegistro,
  lotes: CnabLote[],
  trailerArquivo: CnabRegistro,
}

export function isCnabFile(value: any): value is CnabFile {
  return value?._metadata?.type === 'CnabFile';
}

