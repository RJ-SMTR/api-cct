import { ICnabFieldMapDetalhe } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field-map-detalhe.interface';
import { ICnabFieldMapTrailerArquivo } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field-map-trailer-arquivo.interface';
import { ICnabFieldMapTrailerLote } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field-map-trailer-lote.interface';
import { ICnabFieldMap } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field-map.interface';
import { ICnabFieldMaps } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field-maps.interface';

const registroBase: ICnabFieldMap = {
  registroIdField: 'codigoRegistro',
  registroLoteSequenceField: 'loteServico',
};

const trailerArquivo: ICnabFieldMapTrailerArquivo = {
  ...registroBase,
  trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
  trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
};

const trailerLote: ICnabFieldMapTrailerLote = {
  ...registroBase,
  trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
};

const detalheLote: ICnabFieldMapDetalhe = {
  ...registroBase,
  nsrField: 'nsr',
  detalheSegmentoCodeField: 'codigoSegmento',
};

export const cnab104FieldMapTemplate: ICnabFieldMaps = {
  headerArquivo: registroBase,
  headerLote: registroBase,
  detalheLote: detalheLote,
  trailerLote: trailerLote,
  trailerArquivo: trailerArquivo,
};
