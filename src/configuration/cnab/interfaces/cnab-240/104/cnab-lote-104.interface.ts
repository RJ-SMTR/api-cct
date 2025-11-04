import { CnabHeaderLote104Pgto } from './pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104 } from './cnab-registros-104.interface';
import { CnabTrailerLote104 } from './cnab-trailer-lote-104.interface';
import { CnabHeaderLote104Extrato } from './extrato/cnab-header-lote-104-extrato.interface';

export interface CnabLote104 {
  headerLote: CnabHeaderLote104Pgto | CnabHeaderLote104Extrato;
  registros: CnabRegistros104[];
  trailerLote: CnabTrailerLote104;
}
