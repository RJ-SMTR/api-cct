import { CnabCodigoSegmento } from 'src/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabDetalheA_104 } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabConst } from 'src/cnab/const/cnab.const';

export const cnab240_104DetalheATemplateTest: CnabDetalheA_104 = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', format: CnabConst.format.number() },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.DetalheSegmento,
    format: CnabConst.format.number(),
  },
  nsr: { pos: [9, 13], picture: '9(005)', value: '00001', format: CnabConst.format.number() },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.A,
    format: CnabConst.format.string(),
  },
  tipoMovimento: { pos: [15, 15], picture: '9(001)', value: '0' },
  codigoInstrucaoMovimento: { pos: [16, 17], picture: '9(002)', value: '00' },
  camaraCompensacao: { pos: [18, 20], picture: '9(003)', value: '000' },
  codigoBancoDestino: { pos: [21, 23], picture: '9(003)', value: '104' },
  codigoAgenciaDestino: { pos: [24, 28], picture: '9(005)', value: '00955' },
  dvAgenciaDestino: { pos: [29, 29], picture: 'X(001)', value: '5' },
  contaCorrenteDestino: {
    pos: [30, 41],
    picture: '9(012)',
    value: '003199393318',
  },
  dvContaDestino: { pos: [42, 42], picture: 'X(001)', value: '0' },
  dvAgenciaContaDestino: { pos: [43, 43], picture: 'X(001)', value: ' ' },
  nomeTerceiro: {
    pos: [44, 73],
    picture: 'X(030)',
    value: 'TEREZINHA SEVERIANA           ',
  },
  numeroDocumentoEmpresa: { pos: [74, 79], picture: '9(006)', value: '000027', format: CnabConst.format.number() },
  filler: { pos: [80, 92], picture: 'X(013)', value: '             ' },
  tipoContaFinalidadeTed: { pos: [93, 93], picture: 'X(001)', value: '1' },
  dataVencimento: {
    pos: [94, 101],
    picture: '9(008)',
    value: '05022023',
    format: CnabConst.format.dateFormat(),
  },
  tipoMoeda: { pos: [102, 104], picture: 'X(003)', value: 'BRL' },
  quantidadeMoeda: {
    pos: [105, 119],
    picture: '9(010)V99999',
    value: '000000000000000',
    format: CnabConst.format.number(),
  },
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: 1200.12,
    format: CnabConst.format.number(),
  },
  numeroDocumentoBanco: {
    pos: [135, 143],
    picture: '9(009)',
    value: '000000000',
  },
  filler2: { pos: [144, 146], picture: 'X(003)', value: '   ' },
  quantidadeParcelas: { pos: [147, 148], picture: '9(002)', value: '01', format: CnabConst.format.number() },
  indicadorBloqueio: { pos: [149, 149], picture: 'X(001)', value: 'N' },
  indicadorFormaParcelamento: {
    pos: [150, 150],
    picture: '9(001)',
    value: '1',
  },
  periodoDiaVencimento: { pos: [151, 152], picture: 'X(002)', value: '06' },
  numeroParcela: { pos: [153, 154], picture: '9(002)', value: '00', format: CnabConst.format.number() },
  dataEfetivacao: { pos: [155, 162], picture: '9(008)', value: '00000000', format: CnabConst.format.dateFormat() },
  valorRealEfetivado: {
    pos: [163, 177],
    picture: '9(013)V99',
    value: '000000000000000',
    format: CnabConst.format.number(),
  },
  informacao2: {
    pos: [178, 217],
    picture: 'X(040)',
    value: '                                        ',
  },
  finalidadeDOC: { pos: [218, 219], picture: '9(002)', value: '01' },
  usoExclusivoFebraban: {
    pos: [220, 229],
    picture: 'X(010)',
    value: '          ',
  },
  avisoAoFavorecido: { pos: [230, 230], picture: '9(001)', value: '0' },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ' },
};
