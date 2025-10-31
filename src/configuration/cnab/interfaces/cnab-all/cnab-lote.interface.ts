import { MetadataAs } from 'src/utils/interfaces/metadata.type';
import { CnabRegistro } from './cnab-registro.interface';

export interface CnabLote {
  _metadata: MetadataAs<{ type: 'CnabLote' }>;
  headerLote: CnabRegistro;
  registros: CnabRegistro[];
  trailerLote: CnabRegistro;
}

export function isCnabLote(obj: any): obj is CnabLote {
  return obj?._metadata?.type === 'CnabLote';
}
