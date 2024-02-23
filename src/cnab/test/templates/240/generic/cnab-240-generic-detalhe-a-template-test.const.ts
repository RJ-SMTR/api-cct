import { CnabFields } from 'src/cnab/types/cnab-field.type';

export const cnab240GenericDetalheATemplateTest: CnabFields = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001' },
  codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
  nsr: { pos: [9, 13], picture: '9(005)', value: '00001' },
  codigoSegmento: { pos: [14, 14], picture: 'X(001)', value: 'A' },
  filler: { pos: [15, 119], picture: 'X(105)', value: ' ' },
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: '000000001000010',
  },
  usoFebraban: { pos: [135, 240], picture: 'X(105)', value: ' ' },
};
