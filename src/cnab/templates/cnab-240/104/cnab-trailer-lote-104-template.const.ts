import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabTrailerLote104 } from 'src/cnab/interfaces/cnab-240/104/cnab-trailer-lote-104.interface';

export const cnabTrailerLote104Template: CnabTrailerLote104 = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000', ...Cnab.insert.d() },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.TrailerLote,
    ...Cnab.insert.number(),
  },
  usoExclusivoFebraban: { pos: [9, 17], picture: 'X(009)', value: '         ', ...Cnab.insert.d() },
  quantidadeRegistrosLote: {
    pos: [18, 23],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.d(),
  },
  somatorioValores: {
    pos: [24, 41],
    picture: '9(016)V99',
    value: '000000000000000000',
    ...Cnab.insert.d(),
  },
  somatorioQtdeMoeda: {
    pos: [42, 59],
    picture: '9(013)V99999',
    value: '000000000000000000',
    ...Cnab.insert.d(),
  },
  numeroAvisoDebito: { pos: [60, 65], picture: '9(006)', value: '000000', ...Cnab.insert.d() },
  usoExclusivoFebraban2: {
    pos: [66, 230],
    picture: 'X(165)',
    value: ' '.repeat(165),
    ...Cnab.insert.d(),
  },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ', ...Cnab.insert.d() },
};
