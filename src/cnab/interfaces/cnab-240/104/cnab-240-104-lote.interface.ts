import { ICnab240_104HeaderLote } from './cnab-240-104-header-lote.interface';
import { ICnab240_104Registro } from './cnab-240-104-registro.interface';
import { ICnab240_104TrailerLote } from './cnab-240-104-trailer-lote.interface';

export interface ICnab240_104Lote {
  headerLote: ICnab240_104HeaderLote;
  registros: ICnab240_104Registro[];
  trailerLote: ICnab240_104TrailerLote;
}
