import { Metadata } from 'src/utils/interfaces/metadata.type';
import { CnabFile104 } from '../cnab-file-104.interface';
import { CnabHeaderArquivo104 } from '../cnab-header-arquivo-104.interface';
import { CnabTrailerArquivo104 } from '../cnab-trailer-arquivo-104.interface';
import { CnabLote104Pgto } from './cnab-lote-104-pgto.interface';

export interface CnabFile104Pgto extends CnabFile104 {
  _metadata?: Metadata,
  headerArquivo: CnabHeaderArquivo104;
  lotes: CnabLote104Pgto[];
  trailerArquivo: CnabTrailerArquivo104;
}
