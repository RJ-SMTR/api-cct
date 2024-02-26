import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import {
  CnabField,
  CnabFieldAs,
  CnabFields,
} from '../../../types/cnab-field.type';

export interface ICnab240_104TrailerArquivo extends CnabFields {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  usoExclusivoFebraban: CnabField;
  quantidadeLotesArquivo: CnabField;
  quantidadeRegistrosArquivo: CnabField;
  quantidadeContasConciliacao: CnabField;
  usoExclusivoFebraban2: CnabField;
}
