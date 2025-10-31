import { Cnab } from 'src/configuration/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/configuration/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabTrailerArquivo104 } from 'src/configuration/cnab/interfaces/cnab-240/104/cnab-trailer-arquivo-104.interface';

export const cnabTrailerArquivo104Template: CnabTrailerArquivo104 = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '9999', ...Cnab.insert.d() },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.TrailerArquivo,
    ...Cnab.insert.number()
  },
  usoExclusivoFebraban: { pos: [9, 17], picture: 'X(009)', value: '         ', ...Cnab.insert.d() },
  quantidadeLotesArquivo: { pos: [18, 23], picture: '9(006)', value: '000000', ...Cnab.insert.d() },
  quantidadeRegistrosArquivo: {
    pos: [24, 29],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.d()
  },
  quantidadeContasConciliacao: {
    pos: [30, 35],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.d()
  },
  usoExclusivoFebraban2: {
    pos: [36, 240],
    picture: 'X(205)',
    value: ' '.repeat(205),
    ...Cnab.insert.d()
  },
};
