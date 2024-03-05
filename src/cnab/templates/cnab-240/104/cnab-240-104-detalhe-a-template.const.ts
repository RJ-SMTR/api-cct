import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { ICnab240_104DetalheA } from '../../../interfaces/cnab-240/104/cnab-240-104-detalhe-a.interface';
import { Cnab104CodigoSegmento } from 'src/cnab/enums/104/cnab-104-codigo-segmento.enum';
import { Cnab104FormaParcelamento } from 'src/cnab/enums/104/cnab-104-forma-parcelamento.enum';
import { Cnab104IndicadorBloqueio } from 'src/cnab/enums/104/cnab-104-indicador-bloqueio.enum';
import { Cnab104FinalidadeDoc } from 'src/cnab/enums/104/cnab-104-finalidade-doc.enum';
import { Cnab104TipoMoeda } from 'src/cnab/enums/104/cnab-104-tipo-moeda.enum';

export const cnab240_104DetalheATemplate: ICnab240_104DetalheA = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabAllCodigoRegistro.DetalheSegmento,
  },
  nsr: { pos: [9, 13], picture: '9(005)', value: '     ' },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: Cnab104CodigoSegmento.A,
  },
  tipoMovimento: { pos: [15, 15], picture: '9(001)', value: '0' },
  codigoInstrucaoMovimento: { pos: [16, 17], picture: '9(002)', value: '00' },
  camaraCompensacao: { pos: [18, 20], picture: '9(003)', value: '000' },
  codigoBancoDestino: { pos: [21, 23], picture: '9(003)', value: '000' },
  codigoAgenciaDestino: { pos: [24, 28], picture: '9(005)', value: '00000' },
  dvAgenciaDestino: { pos: [29, 29], picture: 'X(001)', value: ' ' },
  contaCorrenteDestino: {
    pos: [30, 41],
    picture: '9(012)',
    value: '000000000000',
  },
  dvContaDestino: { pos: [42, 42], picture: 'X(001)', value: ' ' },
  dvAgenciaContaDestino: { pos: [43, 43], picture: 'X(001)', value: ' ' },
  nomeTerceiro: {
    pos: [44, 73],
    picture: 'X(030)',
    value: '                              ',
  },
  numeroDocumento: { pos: [74, 79], picture: '9(006)', value: '000000' },
  filler: { pos: [80, 92], picture: 'X(013)', value: '             ' },
  tipoContaFinalidadeTed: { pos: [93, 93], picture: 'X(001)', value: ' ' },
  dataVencimento: { pos: [94, 101], picture: '9(008)', value: '00000000' },
  tipoMoeda: {
    pos: [102, 104],
    picture: 'X(003)',
    value: Cnab104TipoMoeda.Real,
  },
  quantidadeMoeda: {
    pos: [105, 119],
    picture: '9(010)V99999',
    value: '000000000000000',
  },
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  numeroDocumentoBanco: {
    pos: [135, 143],
    picture: '9(009)',
    value: '000000000',
  },
  filler2: { pos: [144, 146], picture: 'X(003)', value: '   ' },
  quantidadeParcelas: { pos: [147, 148], picture: '9(002)', value: 1 },
  indicadorBloqueio: {
    pos: [149, 149],
    picture: 'X(001)',
    value: Cnab104IndicadorBloqueio.Nao,
  },
  indicadorFormaParcelamento: {
    pos: [150, 150],
    picture: '9(001)',
    value: Cnab104FormaParcelamento.DataFixa,
  },
  /** Data fixa, Periódico ou Dia útil */
  periodoDiaVencimento: { pos: [151, 152], picture: 'X(002)', value: '  ' },
  numeroParcela: { pos: [153, 154], picture: '9(002)', value: 1 },
  dataEfetivacao: { pos: [155, 162], picture: '9(008)', value: '00000000' },
  valorRealEfetivado: {
    pos: [163, 177],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  informacao2: {
    pos: [178, 217],
    picture: 'X(040)',
    value: '                                        ',
  },
  finalidadeDOC: {
    pos: [218, 219],
    picture: '9(002)',
    value: Cnab104FinalidadeDoc.CreditoConta,
  },
  usoExclusivoFebraban: {
    pos: [220, 229],
    picture: 'X(010)',
    value: '          ',
  },
  avisoAoFavorecido: { pos: [230, 230], picture: '9(001)', value: '0' },
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ' },
};
