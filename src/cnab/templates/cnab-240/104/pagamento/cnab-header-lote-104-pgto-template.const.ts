import { Cnab } from 'src/cnab/const/cnab.const';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { Cnab104TipoCompromisso } from 'src/cnab/enums/104/cnab-104-tipo-compromisso.enum';
import { Cnab104TipoOperacao } from 'src/cnab/enums/104/cnab-104-tipo-operacao.enum';
import { Cnab104TipoServicoExtrato } from 'src/cnab/enums/104/cnab-104-tipo-servico-extrato.enum';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';

/**
 * PAGAMENTO DE SALÁRIOS, PAGAMENTO/CRÉDITO A FORNECEDOR E AUTOPAGAMENTO E DÉBITO AUTOMÁTICO
 * 
 * @version v032 micro - FEV/2024
 */
export const cnabHeaderLote104PgtoTemplate: CnabHeaderLote104Pgto = {
  /** 1.01 */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  /** 1.02 */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', ...Cnab.insert.d() },
  /** 1.03 */
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.HeaderLote,
    ...Cnab.insert.number(),
  },
  /** 1.04 - Fixo: C (pagamento) */
  tipoOperacao: { pos: [9, 9], picture: 'X(001)', value: Cnab104TipoOperacao.Pagamento, ...Cnab.insert.d() },
  /** 1.05 - 20 pagamento de fornecedor */
  tipoServico: { pos: [10, 11], picture: '9(002)', value: Cnab104TipoServicoExtrato.PagamentoFornecedor, ...Cnab.insert.d() },
  /** 1.06 - Crédito em conta */
  formaLancamento: { pos: [12, 13], picture: '9(002)', value: Cnab104FormaLancamento.CreditoContaCorrente, ...Cnab.insert.d() },
  /** 1.07 - Fixo: 041 */
  versaoLeiauteLote: { pos: [14, 16], picture: '9(003)', value: '041', ...Cnab.insert.d() },
  /** 1.08 - 2 */
  filler: { pos: [17, 17], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 1.09 */
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '2', ...Cnab.insert.d() },
  /** 1.10 */
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00000000000000',
    ...Cnab.insert.d()
  },
  /** 1.11 */
  codigoConvenioBanco: { pos: [33, 38], picture: '9(006)', value: '444773', ...Cnab.insert.d() },
  /** 1.12 */
  tipoCompromisso: {
    pos: [39, 40],
    picture: '9(002)',
    value: Cnab104TipoCompromisso.PagamentoFornecedores,
    ...Cnab.insert.d()
  },
  /** 1.13 -  */
  codigoCompromisso: { pos: [41, 44], picture: '9(004)', value: '0001', ...Cnab.insert.d() },
  /** 1.14 */
  parametroTransmissao: { pos: [45, 46], picture: 'X(002)', value: '  ', ...Cnab.insert.d() },
  /** 1.15 */
  filler2: { pos: [47, 52], picture: 'X(006)', value: '      ', ...Cnab.insert.d() },
  /** 1.16 - Pagador */
  agenciaContaCorrente: { pos: [53, 57], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** 1.17 - Pagador */
  dvAgencia: { pos: [58, 58], picture: 'X(001)', value: '0', ...Cnab.insert.d() },
  /** 1.18 - Pagador */
  numeroConta: { pos: [59, 70], picture: '9(012)', value: '000000000000', ...Cnab.insert.d() },
  /** 1.19 - Pagador */
  dvConta: { pos: [71, 71], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 1.20 - Pagador */
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 1.21 - Pagador */
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d()
  },
  /** 1.22 */
  mensagemAviso: {
    pos: [103, 142],
    picture: 'X(040)',
    value: '                                        ',
    ...Cnab.insert.d()
  },
  /** 1.23 - Pagador */
  logradouro: {
    pos: [143, 172],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d()
  },
  /** 1.24 - Pagador */
  numeroLocal: { pos: [173, 177], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** 1.25 - Pagador */
  complemento: { pos: [178, 192], picture: 'X(015)', value: '               ', ...Cnab.insert.d() },
  /** 1.26 - Pagador */
  cidade: { pos: [193, 212], picture: 'X(020)', value: '                    ', ...Cnab.insert.d() },
  /** 1.27 - Pagador */
  cep: { pos: [213, 217], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** 1.28 - Pagador */
  complementoCep: { pos: [218, 220], picture: 'X(003)', value: '   ', ...Cnab.insert.d() },
  /** 1.29 - Pagador */
  siglaEstado: { pos: [221, 222], picture: 'X(002)', value: '  ', ...Cnab.insert.d() },
  /** 1.30 */
  usoExclusivoFebraban: {
    pos: [223, 230],
    picture: 'X(008)',
    value: '        ',
    ...Cnab.insert.d()
  },
  /** 1.31 */
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ', ...Cnab.insert.d() },
};

