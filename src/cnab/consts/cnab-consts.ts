import { cnab240_104DetalheATemplate } from './caixa/240/cnab-240-104-detalhe-a-template.const';
import { cnab240_104DetalheBTemplate } from './caixa/240/cnab-240-104-detalhe-b-template.const';
import { cnab240_104HeaderArquivoTemplate } from './caixa/240/cnab-240-104-header-arquivo-template.const';
import { cnab240_104HeaderLoteTemplate } from './caixa/240/cnab-240-104-header-lote-template.const';
import { cnab240_104TrailerArquivoTemplate } from './caixa/240/cnab-240-104-trailer-arquivo-template.const';
import { cnab240_104TrailerLoteTemplate } from './caixa/240/cnab-240-104-trailer-lote-template.const';

export const CNAB_YAML_DIR = './yaml';
export const CNAB_BANK = {
  caixa: {
    code: '104',
    remessa: {
      240: ['header_arquivo', 'detalhe', 'trailer_arquivo'],
    },
    retorno: {
      240: ['header_arquivo', 'detalhe', 'trailer_arquivo'],
    },
  },
};

export const CNAB_MODULES = {
  caixa: {
    remessa: {
      240: {
        templates: [
          cnab240_104HeaderArquivoTemplate,
          cnab240_104HeaderLoteTemplate,
          cnab240_104DetalheATemplate,
          cnab240_104DetalheBTemplate,
          cnab240_104TrailerLoteTemplate,
          cnab240_104TrailerArquivoTemplate,
        ],
      },
    },
  },
};
