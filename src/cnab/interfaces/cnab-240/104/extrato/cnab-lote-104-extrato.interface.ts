import { CnabTrailerLote104 } from "../cnab-trailer-lote-104.interface";
import { CnabHeaderLote104Extrato } from "./cnab-header-lote-104-extrato.interface";
import { CnabRegistros104Extrato } from "./cnab-registros-104-extrato.interface";

export interface CnabLote104Extrato {
  headerLote: CnabHeaderLote104Extrato;
  registros: CnabRegistros104Extrato[];
  trailerLote: CnabTrailerLote104;
}
