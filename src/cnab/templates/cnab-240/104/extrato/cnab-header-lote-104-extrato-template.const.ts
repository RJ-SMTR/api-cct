import { CnabConst } from 'src/cnab/const/cnab.const';
import { CnabHeaderLote104Extrato } from 'src/cnab/interfaces/cnab-240/104/extrato/cnab-header-lote-104-extrato.interface';

export const cnabHeaderLote104ExtratoTemplate: CnabHeaderLote104Extrato = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', format: CnabConst.format.number() },
  codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '1', format: CnabConst.format.number() },
  tipoOperacao: { pos: [9, 9], picture: 'X(001)', value: 'E' },
  tipoServico: { pos: [10, 11], picture: '9(002)', value: '04' },
  formaLancamento: { pos: [12, 13], picture: '9(002)', value: '40' },
  versaoLeiauteLote: { pos: [14, 16], picture: '9(003)', value: '033' },
  usoExclusivoFebraban: { pos: [17, 17], picture: 'X(001)', value: ' ' },
  /** Cliente */
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '1' },
  /** Cpf/Cnpj cliente */
  numeroInscricao: { pos: [19, 32], picture: '9(014)', value: '00000000000000' },
  /** Código empresa banco */
  codigoConvenioBanco: { pos: [33, 52], picture: '9(020)', value: '00000000000000000000' },
  /** agencia Mantenedora Conta */
  agencia: { pos: [53, 57], picture: '9(005)', value: '00000' },
  dVAgencia: { pos: [58, 58], picture: '9(001)', value: '0' },
  conta: { pos: [59, 70], picture: 'X(012)', value: '000000000000' },
  dvConta: { pos: [71, 71], picture: 'X(001)', value: ' ' },
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: ' ' },
  nomeEmpresa: { pos: [73, 102], picture: 'X(030)', value: '                              ' },
  usoExclusivoFebraban2: { pos: [103, 142], picture: 'X(040)', value: '                                        ' },
  /** DDMMAAAA */
  dataSaldoInicial: { pos: [143, 150], picture: '9(008)', value: '00000000', format: CnabConst.format.dateFormat() },
  valorSaldoInicial: { pos: [151, 168], picture: '9(016)V9(02)', value: '0000000000000000', format: CnabConst.format.number() },
  situacaoSaldoInicial: { pos: [169, 169], picture: 'X(001)', value: ' ' },
  posicaoSaldoInicial: { pos: [170, 170], picture: 'X(001)', value: ' ' },
  /** Moeda referenciada no extrato */
  tipoMoeda: { pos: [171, 173], picture: 'X(003)', value: 'BRL' },
  /** Número de sequência do extrato */
  sequenciaExtrato: { pos: [174, 178], picture: '9(005)', value: '00000' },
  usoExclusivoFebraban3: { pos: [179, 240], picture: 'X(062)', value: '                                                          ' },
};

