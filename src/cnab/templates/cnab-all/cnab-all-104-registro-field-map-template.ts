import { ICnabFieldMapDetalhe } from 'src/cnab/dto/CnabFieldMapDetalheDTO';
import { ICnabFieldMapTrailerArquivo } from 'src/cnab/dto/CnabFieldMapTrailerArquivoDTO';
import { ICnabFieldMapTrailerLote } from 'src/cnab/dto/CnabFieldMapTrailerLoteDTO';
import { ICnabFieldMap } from 'src/cnab/dto/CnabFieldMapDTO';

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
  detalheSegmentoField: 'codigoSegmento',
};

export const cnabAll104FieldMapTemplate = {
  headerArquivo: registro,
  headerLote: registro,
  detalheLote: detalheLote,
  trailerLote: trailerLote,
  trailerArquivo: trailerArquivo,
};
