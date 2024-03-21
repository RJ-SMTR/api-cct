import { cnab240_104DetalheATemplate } from "./cnab-240-104-detalhe-a-template.const";
import { cnab240_104DetalheBTemplate } from "./cnab-240-104-detalhe-b-template.const";
import { cnab240_104HeaderArquivoTemplate } from "./cnab-240-104-header-arquivo-template.const";
import { cnab240_104HeaderLoteTemplate } from "./cnab-240-104-header-lote-template.const";
import { cnab240_104TrailerArquivoTemplate } from "./cnab-240-104-trailer-arquivo-template.const";
import { cnab240_104TrailerLoteTemplate } from "./cnab-240-104-trailer-lote-template.const";

export const Cnab240_104RemessaTemplates = {
  headerArquivo: cnab240_104HeaderArquivoTemplate,
  headerLote: cnab240_104HeaderLoteTemplate,
  detalheA: cnab240_104DetalheATemplate,
  detalheB: cnab240_104DetalheBTemplate,
  trailerLote: cnab240_104TrailerLoteTemplate,
  trailerArquivo: cnab240_104TrailerArquivoTemplate,
}