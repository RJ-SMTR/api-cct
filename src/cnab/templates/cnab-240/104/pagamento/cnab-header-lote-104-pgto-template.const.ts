import { Cnab } from 'src/cnab/const/cnab.const';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { Cnab104TipoCompromisso } from 'src/cnab/enums/104/cnab-104-tipo-compromisso.enum';
import { Cnab104TipoOperacao } from 'src/cnab/enums/104/cnab-104-tipo-operacao.enum';
import { Cnab104TipoServicoExtrato } from 'src/cnab/enums/104/cnab-104-tipo-servico-extrato.enum';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';

export const cnabHeaderLote104PgtoTemplate: CnabHeaderLote104Pgto = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', ...Cnab.insert.d() },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.HeaderLote,
    ...Cnab.insert.number(),
  },
  /** Fixo: C (pagamento) */
  tipoOperacao: { pos: [9, 9], picture: 'X(001)', value: Cnab104TipoOperacao.Pagamento, ...Cnab.insert.d() },
  /** 20 pagamento de fornecedor */
  tipoServico: { pos: [10, 11], picture: '9(002)', value: Cnab104TipoServicoExtrato.PagamentoFornecedor, ...Cnab.insert.d() },
  /** Crédito em conta */
  formaLancamento: { pos: [12, 13], picture: '9(002)', value: Cnab104FormaLancamento.CreditoContaCorrente, ...Cnab.insert.d() },
  /** Fixo: 041 */
  versaoLeiauteLote: { pos: [14, 16], picture: '9(003)', value: '041', ...Cnab.insert.d() },
  filler: { pos: [17, 17], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** 2 */
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '2', ...Cnab.insert.d() },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00000000000000',
    ...Cnab.insert.d()
  },
  codigoConvenioBanco: { pos: [33, 38], picture: '9(006)', value: '000000', ...Cnab.insert.d() },
  tipoCompromisso: {
    pos: [39, 40],
    picture: '9(002)',
    value: Cnab104TipoCompromisso.PagamentoFornecedores,
    ...Cnab.insert.d()
  },
  codigoCompromisso: { pos: [41, 44], picture: '9(004)', value: '0000', ...Cnab.insert.d() },
  parametroTransmissao: { pos: [45, 46], picture: 'X(002)', value: '  ', ...Cnab.insert.d() },
  filler2: { pos: [47, 52], picture: 'X(006)', value: '      ', ...Cnab.insert.d() },
  /** Pagador */
  agenciaContaCorrente: { pos: [53, 57], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** Pagador */
  dvAgencia: { pos: [58, 58], picture: '9(001)', value: '0', ...Cnab.insert.d() },
  /** Pagador */
  numeroConta: { pos: [59, 70], picture: '9(012)', value: '000000000000', ...Cnab.insert.d() },
  /** Pagador */
  dvConta: { pos: [71, 71], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** Pagador */
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  /** Pagador */
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d()
  },
  mensagemAviso: {
    pos: [103, 142],
    picture: 'X(040)',
    value: '                                        ',
    ...Cnab.insert.d()
  },
  /** Pagador */
  logradouro: {
    pos: [143, 172],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d()
  },
  /** Pagador */
  numeroLocal: { pos: [173, 177], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** Pagador */
  complemento: { pos: [178, 192], picture: '9(015)', value: '000000000000000', ...Cnab.insert.d() },
  /** Pagador */
  cidade: { pos: [193, 212], picture: 'X(020)', value: '                    ', ...Cnab.insert.d() },
  /** Pagador */
  cep: { pos: [213, 217], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** Pagador */
  complementoCep: { pos: [218, 220], picture: 'X(003)', value: '   ', ...Cnab.insert.d() },
  /** Pagador */
  siglaEstado: { pos: [221, 222], picture: 'X(002)', value: '  ', ...Cnab.insert.d() },
  usoExclusivoFebraban: {
    pos: [223, 230],
    picture: 'X(008)',
    value: '        ',
    ...Cnab.insert.d()
  },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ', ...Cnab.insert.d() },
};

