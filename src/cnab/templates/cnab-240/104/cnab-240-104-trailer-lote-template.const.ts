import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { ICnab240_104TrailerLote } from 'src/cnab/interfaces/cnab-240/104/cnab-240-104-trailer-lote.interface';

export const cnab240_104TrailerLoteTemplate: ICnab240_104TrailerLote = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabAllCodigoRegistro.TrailerLote,
  },
  usoExclusivoFebraban: { pos: [9, 17], picture: 'X(009)', value: '         ' },
  quantidadeRegistrosLote: {
    pos: [18, 23],
    picture: '9(006)',
    value: '000000',
  },
  somatorioValores: {
    pos: [24, 41],
    picture: '9(016)V99',
    value: '000000000000000000',
  },
  somatorioQtdeMoeda: {
    pos: [42, 59],
    picture: '9(013)V99999',
    value: '000000000000000000',
  },
  numeroAvisoDebito: { pos: [60, 65], picture: '9(006)', value: '000000' },
  usoExclusivoFebraban2: {
    pos: [66, 230],
    picture: 'X(165)',
    value: ' '.repeat(165),
  },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ' },
};