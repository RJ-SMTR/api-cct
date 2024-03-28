import { CnabHeaderLote104Pgto } from "./cnab-header-lote-104-pgto.interface";
import { CnabLote104 } from "../cnab-lote-104.interface";
import { CnabTrailerLote104 } from "../cnab-trailer-lote-104.interface";
import { CnabRegistros104Pgto } from "./cnab-registros-104-pgto.interface";

export interface CnabLote104Pgto extends CnabLote104 {
  headerLote: CnabHeaderLote104Pgto;
  registros: CnabRegistros104Pgto[];
  trailerLote: CnabTrailerLote104;
}
