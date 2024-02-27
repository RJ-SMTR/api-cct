import { ICnabFieldMap } from 'src/cnab/dto/CnabFieldMapDTO';

const base: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico',
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
  detalheSegmentoField: 'codigoSegmento',
  detalheLoteRegistroSequenceField: 'nsr',
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

const detalheB: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico2',
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
  detalheSegmentoField: 'codigoSegmento',
  detalheLoteRegistroSequenceField: 'nsr',
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

export const cnab240GenericFieldMapTemplateTest = {
  base: base,
  detalheB: detalheB,
};
