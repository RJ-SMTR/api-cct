import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { Cnab104TipoCompromisso } from 'src/cnab/enums/104/cnab-104-tipo-compromisso.enum';
import { Cnab104TipoOperacao } from 'src/cnab/enums/104/cnab-104-tipo-operacao.enum';
import { Cnab104TipoServico } from 'src/cnab/enums/104/cnab-104-tipo-servico.enum';
import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { ICnab240_104HeaderLote } from 'src/cnab/interfaces/cnab-240/104/cnab-240-104-header-lote.interface';

export const cnab240_104HeaderLoteTemplate: ICnab240_104HeaderLote = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabAllCodigoRegistro.HeaderLote,
  },
  /** Fixo: C (pagamento) */
  tipoOperacao: { pos: [9, 9], picture: 'X(001)', value: Cnab104TipoOperacao.Pagamento },
  /** 20 pagamento de fornecedor */
  tipoServico: { pos: [10, 11], picture: '9(002)', value: Cnab104TipoServico.PagamentoFornecedor },
  /** Crédito em conta */
  formaLancamento: { pos: [12, 13], picture: '9(002)', value: Cnab104FormaLancamento.CreditoContaCorrente },
  /** Fixo: 041 */
  versaoLeiauteLote: { pos: [14, 16], picture: '9(003)', value: '041' },
  filler: { pos: [17, 17], picture: 'X(001)', value: ' ' },
  /** 2 */
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '2' },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00000000000000',
  },
  codigoConvenioBanco: { pos: [33, 38], picture: '9(006)', value: '000000' },
  tipoCompromisso: {
    pos: [39, 40],
    picture: '9(002)',
    value: Cnab104TipoCompromisso.PagamentoFornecedores,
  },
  codigoCompromisso: { pos: [41, 44], picture: '9(004)', value: '0000' },
  parametroTransmissao: { pos: [45, 46], picture: 'X(002)', value: '  ' },
  filler2: { pos: [47, 52], picture: 'X(006)', value: '      ' },
  /** Pagador */
  agenciaContaCorrente: { pos: [53, 57], picture: '9(005)', value: '00000' },
  /** Pagador */
  dvAgencia: { pos: [58, 58], picture: '9(001)', value: '0' },
  /** Pagador */
  numeroConta: { pos: [59, 70], picture: '9(012)', value: '000000000000' },
  /** Pagador */
  dvConta: { pos: [71, 71], picture: 'X(001)', value: ' ' },
  /** Pagador */
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: ' ' },
  /** Pagador */
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: '                              ',
  },
  mensagemAviso: {
    pos: [103, 142],
    picture: 'X(040)',
    value: '                                        ',
  },
  /** Pagador */
  logradouro: {
    pos: [143, 172],
    picture: 'X(030)',
    value: '                              ',
  },
  /** Pagador */
  numeroLocal: { pos: [173, 177], picture: '9(005)', value: '00000' },
  /** Pagador */
  complemento: { pos: [178, 192], picture: '9(015)', value: '000000000000000' },
  /** Pagador */
  cidade: { pos: [193, 212], picture: 'X(020)', value: '                    ' },
  /** Pagador */
  cep: { pos: [213, 217], picture: '9(005)', value: '00000' },
  /** Pagador */
  complementoCep: { pos: [218, 220], picture: 'X(003)', value: '   ' },
  /** Pagador */
  siglaEstado: { pos: [221, 222], picture: 'X(002)', value: '  ' },
  usoExclusivoFebraban: {
    pos: [223, 230],
    picture: 'X(008)',
    value: '        ',
  },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ' },
};

