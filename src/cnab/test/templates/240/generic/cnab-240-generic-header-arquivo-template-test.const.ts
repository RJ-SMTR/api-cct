import { CnabFields } from 'src/cnab/types/cnab-field.type';

export const cnab240GenericHeaderArquivoTemplateTest: CnabFields = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0090' },
  codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '0' },
  filler: { pos: [9, 17], picture: 'X(009)', value: '         ' },
  nsa: { pos: [158, 163], picture: '9(006)', value: '000101' },
  filler2: { pos: [164, 240], picture: 'X(077)', value: ' ' },
};
