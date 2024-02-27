import { ICnab240_104DetalheA } from '../interfaces/cnab-240/104/cnab-240-104-detalhe-a.interface';
import { ICnab240_104DetalheB } from '../interfaces/cnab-240/104/cnab-240-104-detalhe-b.interface';
import { ICnab240_104HeaderArquivo } from '../interfaces/cnab-240/104/cnab-240-104-header-arquivo.interface';
import { ICnab240_104HeaderLote } from '../interfaces/cnab-240/104/cnab-240-104-header-lote.interface';
import { ICnab240_104TrailerArquivo } from '../interfaces/cnab-240/104/cnab-240-104-trailer-arquivo.interface';
import { ICnab240_104TrailerLote } from '../interfaces/cnab-240/104/cnab-240-104-trailer-lote.interface';

export class CnabDto {
  headerArquivo: ICnab240_104HeaderArquivo;
  lotes: {
    headerLote: ICnab240_104HeaderLote;
    registros: {
      detalheA: ICnab240_104DetalheA;
      detalheB: ICnab240_104DetalheB;
    }[];
    trailerLote: ICnab240_104TrailerLote;
  }[];
  trailerArquivo: ICnab240_104TrailerArquivo;
}
