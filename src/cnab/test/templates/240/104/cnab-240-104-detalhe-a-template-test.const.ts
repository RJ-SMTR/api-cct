import { CnabCodigoSegmento } from 'src/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabDetalheA_104 } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { Cnab } from 'src/cnab/const/cnab.const';

export const cnab240_104DetalheATemplateTest: CnabDetalheA_104 = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d(), },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', ...Cnab.insert.number() },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.DetalheSegmento,
    ...Cnab.insert.number(),
  },
  nsr: { pos: [9, 13], picture: '9(005)', value: '00001', ...Cnab.insert.number() },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.A,
    ...Cnab.insert.string(),
  },
  tipoMovimento: { pos: [15, 15], picture: '9(001)', value: '0', ...Cnab.insert.d(), },
  codigoInstrucaoMovimento: { pos: [16, 17], picture: '9(002)', value: '00', ...Cnab.insert.d(), },
  camaraCompensacao: { pos: [18, 20], picture: '9(003)', value: '000', ...Cnab.insert.d(), },
  codigoBancoDestino: { pos: [21, 23], picture: '9(003)', value: '104', ...Cnab.insert.d(), },
  codigoAgenciaDestino: { pos: [24, 28], picture: '9(005)', value: '00955', ...Cnab.insert.d(), },
  dvAgenciaDestino: { pos: [29, 29], picture: 'X(001)', value: '5', ...Cnab.insert.d(), },
  contaCorrenteDestino: {
    pos: [30, 41],
    picture: '9(012)',
    value: '003199393318',
    ...Cnab.insert.d(),
  },
  dvContaDestino: { pos: [42, 42], picture: 'X(001)', value: '0', ...Cnab.insert.d(), },
  dvAgenciaContaDestino: { pos: [43, 43], picture: 'X(001)', value: ' ', ...Cnab.insert.d(), },
  nomeTerceiro: {
    pos: [44, 73],
    picture: 'X(030)',
    value: 'TEREZINHA SEVERIANA           ',
    ...Cnab.insert.d(),
  },
  numeroDocumentoEmpresa: { pos: [74, 79], picture: '9(006)', value: '000027', ...Cnab.insert.number() },
  filler: { pos: [80, 92], picture: 'X(013)', value: '             ', ...Cnab.insert.d(), },
  tipoContaFinalidadeTed: { pos: [93, 93], picture: 'X(001)', value: '1', ...Cnab.insert.d(), },
  dataVencimento: {
    pos: [94, 101],
    picture: '9(008)',
    value: '05022023',
    ...Cnab.insert.date(),
  },
  tipoMoeda: { pos: [102, 104], picture: 'X(003)', value: 'BRL', ...Cnab.insert.d(), },
  quantidadeMoeda: {
    pos: [105, 119],
    picture: '9(010)V99999',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: 1200.12,
    ...Cnab.insert.number(),
  },
  numeroDocumentoBanco: {
    pos: [135, 143],
    picture: '9(009)',
    value: '000000000',
    ...Cnab.insert.d(),
  },
  filler2: { pos: [144, 146], picture: 'X(003)', value: '   ', ...Cnab.insert.d(), },
  quantidadeParcelas: { pos: [147, 148], picture: '9(002)', value: '01', ...Cnab.insert.number() },
  indicadorBloqueio: { pos: [149, 149], picture: 'X(001)', value: 'N', ...Cnab.insert.d(), },
  indicadorFormaParcelamento: {
    pos: [150, 150],
    picture: '9(001)',
    value: '1',
    ...Cnab.insert.d(),
  },
  periodoDiaVencimento: { pos: [151, 152], picture: 'X(002)', value: '06', ...Cnab.insert.d(), },
  numeroParcela: { pos: [153, 154], picture: '9(002)', value: '00', ...Cnab.insert.number(), },
  dataEfetivacao: { pos: [155, 162], picture: '9(008)', value: '00000000', ...Cnab.insert.date() },
  valorRealEfetivado: {
    pos: [163, 177],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  informacao2: {
    pos: [178, 217],
    picture: 'X(040)',
    value: '                                        ',
    ...Cnab.insert.d(),
  },
  finalidadeDOC: { pos: [218, 219], picture: '9(002)', value: '01', ...Cnab.insert.d(), },
  usoExclusivoFebraban: {
    pos: [220, 229],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
  avisoAoFavorecido: { pos: [230, 230], picture: '9(001)', value: '0', ...Cnab.insert.d(), },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ', ...Cnab.insert.d(), },
};
