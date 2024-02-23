import { CnabFields } from 'src/cnab/types/cnab-field.type';

export const cnab240GenericHeaderLoteTemplateTest: CnabFields = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001' },
  codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '1' },
  filler: { pos: [9, 240], picture: 'X(232)', value: ' ' },
};
