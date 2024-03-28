import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabFields } from 'src/cnab/interfaces/cnab-field.interface';

export const cnab240GenericHeaderLoteTemplateTest: CnabFields = {
  codigoRegistro: { pos: [1, 1], picture: '9(001)', value: '0', ...Cnab.insert.d(),  },
  loteServico: { pos: [2, 5], picture: '9(004)', value: '', ...Cnab.insert.d(),  },
  quantidadeRegistrosLote: { pos: [6, 11], picture: '9(006)', value: '0', ...Cnab.insert.d(),  },
  codigoSegmento: { pos: [12, 12], picture: 'X(001)', value: ' ', ...Cnab.insert.d(),  },
  nsr: { pos: [13, 17], picture: '9(005)', value: '', ...Cnab.insert.d(),  },
  quantidadeLotesArquivo: { pos: [18, 23], picture: '9(006)', value: '', ...Cnab.insert.d(),  },
  quantidadeRegistrosArquivo: {
    pos: [24, 29],
    picture: '9(006)',
    value: '',
    ...Cnab.insert.d(),
  },
  info: { pos: [30, 39], picture: 'X(010)', value: ' ', ...Cnab.insert.d() },
  filler: { pos: [40, 240], picture: 'X(201)', value: ' ', ...Cnab.insert.d() },
};
