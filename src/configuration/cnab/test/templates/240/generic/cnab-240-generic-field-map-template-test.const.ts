import { ICnabFieldMap } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field-map.interface';

const base: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico',
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
  detalheSegmentoCodeField: 'codigoSegmento',
  nsrField: 'nsr',
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

const detalheB: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico2',
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
  detalheSegmentoCodeField: 'codigoSegmento',
  nsrField: 'nsr',
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

export const cnab240GenericFieldMapTemplateTest = {
  base: base,
  detalheB: detalheB,
};
