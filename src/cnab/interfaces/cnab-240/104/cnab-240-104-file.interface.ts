import { ICnab240_104HeaderArquivo } from './cnab-240-104-header-arquivo.interface';
import { ICnab240_104Lote } from './cnab-240-104-lote.interface';
import { ICnab240_104TrailerArquivo } from './cnab-240-104-trailer-arquivo.interface';

export interface ICnab240_104File {
  headerArquivo: ICnab240_104HeaderArquivo;
  lotes: ICnab240_104Lote[];
  trailerArquivo: ICnab240_104TrailerArquivo;
}
