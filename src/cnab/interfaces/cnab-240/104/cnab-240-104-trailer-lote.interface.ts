import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import {
  CnabField,
  CnabFieldAs,
  CnabFields,
} from '../../../types/cnab-field.type';

export interface ICnab240_104TrailerLote extends CnabFields {
  codigoBanco: CnabField;
  /** O mesmo valor que o `HeaderLote.loteServico` deste lote. */
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  usoExclusivoFebraban: CnabField;
  quantidadeRegistrosLote: CnabField;
  /** Soma de todos os valores: detalhe A, I, O, N */
  somatorioValores: CnabField;
  somatorioQtdeMoeda: CnabField;
  numeroAvisoDebito: CnabField;
  usoExclusivoFebraban2: CnabField;
  ocorrencias: CnabField;
}
