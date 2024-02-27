import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { ICnab240_104TrailerArquivo } from 'src/cnab/dto/Cnab240TrailerArquivoDTO';

export const cnab240_104TrailerArquivoTemplate: ICnab240_104TrailerArquivo = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '9999' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabAllCodigoRegistro.TrailerArquivo,
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
