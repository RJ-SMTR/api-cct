import { Metadata } from 'src/utils/interfaces/metadata.type';
import { CnabHeaderArquivo104 } from './cnab-header-arquivo-104.interface';
import { CnabLote104 } from './cnab-lote-104.interface';
import { CnabTrailerArquivo104 } from './cnab-trailer-arquivo-104.interface';

export interface CnabFile104 {
  _metadata?: Metadata,
  headerArquivo: CnabHeaderArquivo104;
  lotes: CnabLote104[];
  trailerArquivo: CnabTrailerArquivo104;
}
