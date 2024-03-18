import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import {
  CnabField,
  CnabFieldAs
} from '../../../types/cnab-field.type';

/**
 * @extends {CnabFields}
 */
export interface ICnab240_104TrailerArquivo {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  usoExclusivoFebraban: CnabField;
  quantidadeLotesArquivo: CnabField;
  quantidadeRegistrosArquivo: CnabField;
  quantidadeContasConciliacao: CnabField;
  usoExclusivoFebraban2: CnabField;
}
