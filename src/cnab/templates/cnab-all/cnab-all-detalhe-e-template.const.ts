import { CnabAllConst } from 'src/cnab/const/cnab-all.const';
import { ICnab240AllDetalheE } from 'src/cnab/interfaces/cnab-240/all/cnab-240-all-detalhe-e.interface';

export const cnab240AllDetalheETemplate: ICnab240AllDetalheE = {
  /** Fixo: 104 (Caixa) */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '000' },
  /** Automático */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000' },
  /** Tipo de Registro  */
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: '0',
  },
  /** Automático. Número de registro no lote. */
  nsr: { pos: [9, 13], picture: '9(005)', value: '00000' },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: ' ',
  },
  usoExclusivoFebraban: { pos: [15, 17], picture: 'X(003)', value: '   ' },
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '1' },
  numeroInscricao: { pos: [19, 32], picture: '9(014)', value: '0'.repeat(14) },
  codigoConvenioBanco: { pos: [33, 52], picture: 'X(020)', value: ' '.repeat(20) },
  agencia: { pos: [53, 57], picture: '9(005)', value: '     ' },
  dvAgencia: { pos: [58, 58], picture: 'X(001)', value: ' ' },
  conta: { pos: [59, 70], picture: '9(012)', value: '0'.repeat(12) },
  dvConta: { pos: [71, 71], picture: 'X(001)', value: ' ' },
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: '0' },
  nomeEmpresa: { pos: [73, 102], picture: 'X(030)', value: ' '.repeat(30) },
  usoExclusivoFebraban2: { pos: [103, 108], picture: 'X(006)', value: '      ' },
  naturezaLancamento: { pos: [109, 111], picture: 'X(003)', value: '   ' },
  tipoComplementoLancamento: { pos: [112, 113], picture: '9(002)', value: '00' },
  isencaoCpmf: { pos: [134, 134], picture: 'X(001)', value: ' ' },
  dataContabil: { pos: [135, 142], picture: '9(008)', value: '00000000', dateFormat: CnabAllConst.dateFormat },
  dataLancamento: { pos: [143, 150], picture: '9(008)', value: '00000000', dateFormat: CnabAllConst.dateFormat },
  valorLancamento: { pos: [151, 168], picture: '9(016)V99', value: '0'.repeat(18) },
  tipoLancamento: { pos: [169, 169], picture: 'X(001)', value: ' ' },
  categoriaLancamento: { pos: [170, 172], picture: '9(003)', value: '000' },
  codigoHistoricoBanco: { pos: [173, 176], picture: 'X(004)', value: '    ' },
  descricaoHistoricoBanco: { pos: [177, 201], picture: 'X(025)', value: ' '.repeat(25) },
  numeroDocumento: { pos: [202, 240], picture: 'X(039)', value: ' '.repeat(39) },
};
