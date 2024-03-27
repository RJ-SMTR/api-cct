import { CnabConst } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabTrailerArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-trailer-arquivo-104.interface';

export const cnabTrailerArquivo104Template: CnabTrailerArquivo104 = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '9999' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.TrailerArquivo,
    format: CnabConst.format.number(),
  },
  usoExclusivoFebraban: { pos: [9, 17], picture: 'X(009)', value: '         ' },
  quantidadeLotesArquivo: { pos: [18, 23], picture: '9(006)', value: '000000' },
  quantidadeRegistrosArquivo: {
    pos: [24, 29],
    picture: '9(006)',
    value: '000000',
  },
  quantidadeContasConciliacao: {
    pos: [30, 35],
    picture: '9(006)',
    value: '000000',
  },
  usoExclusivoFebraban2: {
    pos: [36, 240],
    picture: 'X(205)',
    value: ' '.repeat(205),
  },
};
