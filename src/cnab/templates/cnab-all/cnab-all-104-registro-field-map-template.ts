import { ICnabFieldMapDetalhe } from 'src/cnab/interfaces/cnab-all/cnab-field-map-detalhe.interface';
import { ICnabFieldMapTrailerArquivo } from 'src/cnab/interfaces/cnab-all/cnab-field-map-trailer-arquivo.interface';
import { ICnabFieldMapTrailerLote } from 'src/cnab/interfaces/cnab-all/cnab-field-map-trailer-lote.interface';
import { ICnabFieldMap } from 'src/cnab/interfaces/cnab-all/cnab-field-map.interface';

const registro: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico',
};

const trailerArquivo: ICnabFieldMapTrailerArquivo = {
  ...registro,
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

const trailerLote: ICnabFieldMapTrailerLote = {
  ...registro,
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
};

const detalheLote: ICnabFieldMapDetalhe = {
  ...registro,
  detalheLoteRegistroSequenceField: 'nsr',
  detalheSegmentoCodeField: 'codigoSegmento',
};

export const cnabAll104FieldMapTemplate = {
  headerArquivo: registro,
  headerLote: registro,
  detalheLote: detalheLote,
  trailerLote: trailerLote,
  trailerArquivo: trailerArquivo,
};
