import { cnab240AllDetalheETemplate } from "../../cnab-all/cnab-all-detalhe-e-template.const";
import { cnab240_104HeaderArquivoTemplate } from "./cnab-240-104-header-arquivo-template.const";
import { cnab240_104HeaderLoteTemplate } from "./cnab-240-104-header-lote-template.const";
import { cnab240_104TrailerArquivoTemplate } from "./cnab-240-104-trailer-arquivo-template.const";
import { cnab240_104TrailerLoteTemplate } from "./cnab-240-104-trailer-lote-template.const";

export const Cnab240_104ExtratoTemplates = {
  headerArquivo: cnab240_104HeaderArquivoTemplate,
  headerLote: cnab240_104HeaderLoteTemplate,
  detalheE: cnab240AllDetalheETemplate,
  trailerLote: cnab240_104TrailerLoteTemplate,
  trailerArquivo: cnab240_104TrailerArquivoTemplate,
}