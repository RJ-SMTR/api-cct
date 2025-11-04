import { Cnab } from 'src/configuration/cnab/const/cnab.const';
import { CnabHeaderLote104Extrato } from 'src/configuration/cnab/interfaces/cnab-240/104/extrato/cnab-header-lote-104-extrato.interface';

/**
 * EXTRATO ELETRÔNICO PARA CONCILIAÇÃO BANCÁRIA
 * @version v005 micro MAIO/2022
 */
export const cnabHeaderLote104ExtratoTemplate: CnabHeaderLote104Extrato = {
  /** 01.1 */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  /** 02.1 */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', ...Cnab.insert.number() },
  /** 03.1 */
  codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '1', ...Cnab.insert.number() },
  /** 04.1 */
  tipoOperacao: { pos: [9, 9], picture: 'X(001)', value: 'E', ...Cnab.insert.d() },
  /** 05.1 */
  tipoServico: { pos: [10, 11], picture: '9(002)', value: '04', ...Cnab.insert.d() },
  /** 06.1 */
  formaLancamento: { pos: [12, 13], picture: '9(002)', value: '40', ...Cnab.insert.d() },
  /** 07.1 */
  versaoLeiauteLote: { pos: [14, 16], picture: '9(003)', value: '033', ...Cnab.insert.d() },
  /** 08.1 */
  usoExclusivoFebraban: { pos: [17, 17], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 09.1 - Cliente */
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '1', ...Cnab.insert.d() },
  /** 10.1 - Cpf/Cnpj cliente */
  numeroInscricao: { pos: [19, 32], picture: '9(014)', value: '00000000000000', ...Cnab.insert.d() },
  /** 11.1 - Código empresa banco */
  codigoConvenioBanco: { pos: [33, 52], picture: '9(020)', value: '00000000000000000000', ...Cnab.insert.d() },
  /** 12.1 - agencia Mantenedora Conta */
  agencia: { pos: [53, 57], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** 13.1 */
  dVAgencia: { pos: [58, 58], picture: '9(001)', value: '0', ...Cnab.insert.d() },
  /** 14.1 */
  conta: { pos: [59, 70], picture: 'X(012)', value: '000000000000', ...Cnab.insert.d() },
  /** 15.1 */
  dvConta: { pos: [71, 71], picture: '9(001)', value: ' ', ...Cnab.insert.d() },
  /** 16.1 */
  dvAgenciaConta: { pos: [72, 72], picture: '9(001)', value: ' ', ...Cnab.insert.d() },
  /** 17.1 */
  nomeEmpresa: { pos: [73, 102], picture: 'X(030)', value: '                              ', ...Cnab.insert.d() },
  /** 18.1 */
  usoExclusivoFebraban2: { pos: [103, 142], picture: 'X(040)', value: '                                        ', ...Cnab.insert.d() },
  /** 19.1 - DDMMAAAA */
  dataSaldoInicial: { pos: [143, 150], picture: '9(008)', value: '00000000', ...Cnab.insert.date() },
  /** 20.1 */
  valorSaldoInicial: { pos: [151, 168], picture: '9(016)V9(02)', value: '0000000000000000', ...Cnab.insert.number() },
  /** 21.1 */
  situacaoSaldoInicial: { pos: [169, 169], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 22.1 */
  posicaoSaldoInicial: { pos: [170, 170], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 23.1 - Moeda referenciada no extrato */
  tipoMoeda: { pos: [171, 173], picture: 'X(003)', value: 'BRL', ...Cnab.insert.d() },
  /** 24.1 - Número de sequência do extrato */
  sequenciaExtrato: { pos: [174, 178], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** 25.1 */
  usoExclusivoFebraban3: { pos: [179, 240], picture: 'X(062)', value: '                                                          ', ...Cnab.insert.d() },
};

