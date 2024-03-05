import { ICnabFieldMap } from 'src/cnab/interfaces/cnab-all/cnab-field-map.interface';

const base: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico',
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
  detalheSegmentoNameField: 'codigoSegmento',
  detalheLoteRegistroSequenceField: 'nsr',
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

const detalheB: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico2',
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
  detalheSegmentoNameField: 'codigoSegmento',
  detalheLoteRegistroSequenceField: 'nsr',
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

export const cnab240GenericFieldMapTemplateTest = {
  base: base,
  detalheB: detalheB,
};
