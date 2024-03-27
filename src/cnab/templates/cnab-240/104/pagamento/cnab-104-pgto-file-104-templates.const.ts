import { CnabFile104Pgto } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface";
import { CnabHeaderArquivo104Template } from "../cnab-header-arquivo-104-template.const";
import { cnabTrailerArquivo104Template } from "../cnab-trailer-arquivo-104-template.const";
import { cnabTrailerLote104Template } from "../cnab-trailer-lote-104-template.const";
import { cnabDetalheA104Template } from "./cnab-detalhe-a-104-template.const";
import { cnabDetalheB104Template } from "./cnab-detalhe-b-104-template.const";
import { cnabHeaderLote104PgtoTemplate } from "./cnab-header-lote-104-pgto-template.const";

const sc = structuredClone;

export const Cnab104PgtoFile104Templates: CnabFile104Pgto = {
  _metadata: { type: 'ICnab240_104FileExtrato' },
  headerArquivo: sc(CnabHeaderArquivo104Template),
  lotes: [{
    headerLote: sc(cnabHeaderLote104PgtoTemplate),
    registros: [{
      detalheA: sc(cnabDetalheA104Template),
      detalheB: sc(cnabDetalheB104Template),
    }],
    trailerLote: sc(cnabTrailerLote104Template),
  }],
  trailerArquivo: sc(cnabTrailerArquivo104Template),
};
