import { ICnab240_104HeaderArquivo } from './Cnab240HeaderArquivoDTO';
import { ICnab240_104Lote } from './Cnab240LoteDTO';
import { ICnab240_104TrailerArquivo } from './Cnab240TrailerArquivoDTO';

export class Cnab240FileDTO {
  headerArquivo: ICnab240_104HeaderArquivo;
  lotes: ICnab240_104Lote[];
  trailerArquivo: ICnab240_104TrailerArquivo;
}