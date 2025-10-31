import { CnabFile104Extrato } from "src/configuration/cnab/interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface";
import { CnabHeaderArquivo104Template } from "../cnab-header-arquivo-104-template.const";
import { cnabTrailerArquivo104Template } from "../cnab-trailer-arquivo-104-template.const";
import { cnabTrailerLote104Template } from "../cnab-trailer-lote-104-template.const";
import { cnabDetalheE104V030Template } from "./cnab-detalhe-e-104-v030-template.const";
import { cnabHeaderLote104ExtratoTemplate } from "./cnab-header-lote-104-extrato-template.const";

const sc = structuredClone;
export const CnabFile104ExtratoTemplate: CnabFile104Extrato = {
  _metadata: { type: 'CnabFile104Extrato', extends: 'CnabFile104' },
  headerArquivo: sc(CnabHeaderArquivo104Template),
  lotes: [{
    headerLote: sc(cnabHeaderLote104ExtratoTemplate),
    registros: [{
      detalheE: sc(cnabDetalheE104V030Template),
    }],
    trailerLote: sc(cnabTrailerLote104Template),
  }],
  trailerArquivo: sc(cnabTrailerArquivo104Template),
};