import { CnabFields } from 'src/cnab/interfaces/cnab-field.interface';

export const cnab240GenericHeaderArquivoTemplateTest: CnabFields = {
  codigoRegistro: { pos: [1, 1], picture: '9(001)', value: '0' },
  loteServico: { pos: [2, 5], picture: '9(004)', value: '' },
  quantidadeRegistrosLote: { pos: [6, 11], picture: '9(006)', value: '0' },
  codigoSegmento: { pos: [12, 12], picture: 'X(001)', value: ' ' },
  nsr: { pos: [13, 17], picture: '9(005)', value: '' },
  quantidadeLotesArquivo: { pos: [18, 23], picture: '9(006)', value: '' },
  quantidadeRegistrosArquivo: {
    pos: [24, 29],
    picture: '9(006)',
    value: '',
  },
  info: { pos: [30, 39], picture: 'X(010)', value: ' ' },
  filler: { pos: [40, 240], picture: 'X(201)', value: ' ' },
};
