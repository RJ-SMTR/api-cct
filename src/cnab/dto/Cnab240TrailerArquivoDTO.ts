import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import {
  CnabField,
  CnabFieldAs
} from '../types/cnab-field.type';

export class Cnab240TrailerArquivoDTO{
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  usoExclusivoFebraban: CnabField;
  quantidadeLotesArquivo: CnabField;
  quantidadeRegistrosArquivo: CnabField;
  quantidadeContasConciliacao: CnabField;
  usoExclusivoFebraban2: CnabField;
}
