import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';

export const cnab240_104HeaderLoteTemplateTest: CnabHeaderLote104Pgto = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', ...Cnab.insert.d() },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.HeaderLote,
    ...Cnab.insert.number(),
  },
  tipoOperacao: { pos: [9, 9], picture: 'X(001)', value: 'C', ...Cnab.insert.d() },
  tipoServico: { pos: [10, 11], picture: '9(002)', value: '30', ...Cnab.insert.d() },
  formaLancamento: { pos: [12, 13], picture: '9(002)', value: '01', ...Cnab.insert.d() },
  versaoLeiauteLote: { pos: [14, 16], picture: '9(003)', value: '041', ...Cnab.insert.d() },
  filler: { pos: [17, 17], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '2', ...Cnab.insert.d() },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00012345600111',
    ...Cnab.insert.d(),
  },
  codigoConvenioBanco: { pos: [33, 38], picture: '9(006)', value: '112007', ...Cnab.insert.d() },
  tipoCompromisso: { pos: [39, 40], picture: '9(002)', value: '02', ...Cnab.insert.d() },
  codigoCompromisso: { pos: [41, 44], picture: '9(004)', value: '0002', ...Cnab.insert.d() },
  parametroTransmissao: { pos: [45, 46], picture: 'X(002)', value: '01', ...Cnab.insert.d() },
  filler2: { pos: [47, 52], picture: 'X(006)', value: '      ', ...Cnab.insert.d() },
  agenciaContaCorrente: { pos: [53, 57], picture: '9(005)', value: '00955', ...Cnab.insert.d() },
  dvAgencia: { pos: [58, 58], picture: '9(001)', value: '5', ...Cnab.insert.d() },
  numeroConta: { pos: [59, 70], picture: '9(012)', value: '000000000003', ...Cnab.insert.d() },
  dvConta: { pos: [71, 71], picture: 'X(001)', value: '2', ...Cnab.insert.d() },
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: 'CONVE  DE PAGAMENTOSSA E PENSA',
    ...Cnab.insert.d(),
  },
  mensagemAviso: {
    pos: [103, 142],
    picture: 'X(040)',
    value: '                                        ',
    ...Cnab.insert.d(),
  },
  logradouro: {
    pos: [143, 172],
    picture: 'X(030)',
    value: '  RUA ALMIR PEDRAS            ',
    ...Cnab.insert.d(),
  },
  numeroLocal: { pos: [173, 177], picture: '9(005)', value: '     ', ...Cnab.insert.d() },
  complemento: { pos: [178, 192], picture: '9(015)', value: '               ', ...Cnab.insert.d() },
  cidade: { pos: [193, 212], picture: 'X(020)', value: '                    ', ...Cnab.insert.d() },
  cep: { pos: [213, 217], picture: '9(005)', value: '     ', ...Cnab.insert.d() },
  complementoCep: { pos: [218, 220], picture: 'X(003)', value: '   ', ...Cnab.insert.d() },
  siglaEstado: { pos: [221, 222], picture: 'X(002)', value: '  ', ...Cnab.insert.d() },
  usoExclusivoFebraban: {
    pos: [223, 230],
    picture: 'X(008)',
    value: '        ',
    ...Cnab.insert.d(),
  },
  /** Retorna o status de retorno do CNAB (Tabela G059) */
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ', ...Cnab.insert.d() },
};
