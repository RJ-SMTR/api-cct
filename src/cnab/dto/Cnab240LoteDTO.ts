import { Cnab240HeaderLoteDTO } from './Cnab240HeaderLoteDTO';
import { ICnab240_104Registro } from './Cnab240RegistroDTO';
import { ICnab240_104TrailerLote } from './Cnab240TrailerLoteDTO';

export class Cnab240LoteDTO {
  headerLote: Cnab240HeaderLoteDTO;
  registros: Cnab240RegistroDTO[];
  trailerLote: ICnab240_104TrailerLote;
}
