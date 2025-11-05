import { CnabHeaderLote104Pgto } from "src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface";
import { CnabHeaderLote104Extrato } from "src/configuration/cnab/interfaces/cnab-240/104/extrato/cnab-header-lote-104-extrato.interface";

export type Cnab240_104HeaderLote = CnabHeaderLote104Pgto | CnabHeaderLote104Extrato;