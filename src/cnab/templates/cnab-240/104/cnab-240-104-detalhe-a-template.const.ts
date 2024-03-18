import { Cnab104Const } from 'src/cnab/const/cnab-104.const';
import { Cnab104AvisoFavorecido } from 'src/cnab/enums/104/cnab-104-aviso-favorecido.enum';
import { Cnab104CamaraCompensacao } from 'src/cnab/enums/104/cnab-104-camara-compensacao.enum';
import { Cnab104CodigoSegmento } from 'src/cnab/enums/104/cnab-104-codigo-segmento.enum';
import { Cnab104FinalidadeDoc } from 'src/cnab/enums/104/cnab-104-finalidade-doc.enum';
import { Cnab104FormaParcelamento } from 'src/cnab/enums/104/cnab-104-forma-parcelamento.enum';
import { Cnab104IndicadorBloqueio } from 'src/cnab/enums/104/cnab-104-indicador-bloqueio.enum';
import { Cnab104TipoMoeda } from 'src/cnab/enums/104/cnab-104-tipo-moeda.enum';
import { Cnab104TipoMovimento } from 'src/cnab/enums/104/cnab-104-tipo-movimento.enum';
import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { ICnab240_104DetalheA } from '../../../interfaces/cnab-240/104/cnab-240-104-detalhe-a.interface';

export const cnab240_104DetalheATemplate: ICnab240_104DetalheA = {
  /** Fixo: 104 (Caixa) */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  /** Automático */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabAllCodigoRegistro.DetalheSegmento,
  },
  /** Automático */
  nsr: { pos: [9, 13], picture: '9(005)', value: '00000' },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: Cnab104CodigoSegmento.A,
  },
  /** Depende das nossas necessidades. */
  tipoMovimento: { pos: [15, 15], picture: '9(001)', value: Cnab104TipoMovimento.Inclusao },
  /** Fixo: 00 */
  codigoInstrucaoMovimento: { pos: [16, 17], picture: '9(002)', value: '00' },
  /** 
   * TODO: Qual usar? - Anotado
   * 
   * Entendemos que é Doc e OP, vamos confirmar.
   */
  camaraCompensacao: {
    pos: [18, 20], picture: '9(003)',
    value: Cnab104CamaraCompensacao.DocEOrdemPagamento
  },
  /** Favorecido */
  codigoBancoDestino: { pos: [21, 23], picture: '9(003)', value: '000' },
  /** Favorecido */
  codigoAgenciaDestino: { pos: [24, 28], picture: '9(005)', value: '00000' },
  /** Favorecido */
  dvAgenciaDestino: { pos: [29, 29], picture: 'X(001)', value: ' ' },
  /** Favorecido */
  contaCorrenteDestino: {
    pos: [30, 41],
    picture: '9(012)',
    value: '000000000000',
  },
  /** Favorecido */
  dvContaDestino: { pos: [42, 42], picture: 'X(001)', value: ' ' },
  /** Fixo: Branco (1) */
  dvAgenciaContaDestino: { pos: [43, 43], picture: 'X(001)', value: ' ' },
  /** Favorecido */
  nomeTerceiro: {
    pos: [44, 73],
    picture: 'X(030)',
    value: '                              ',
  },
  /** 
   * Número Documento atribuído pela Empresa - obtido do banco
   * 
   * Detalhes: A, J, O, N
   */
  numeroDocumentoEmpresa: { pos: [74, 79], picture: '9(006)', value: '000000' },
  filler: { pos: [80, 92], picture: 'X(013)', value: '             ' },
  /** Obter de favorecido.cpfCnpj */
  tipoContaFinalidadeTed: { pos: [93, 93], picture: 'X(001)', value: ' ' },
  /** DDMMAAAA */
  dataVencimento: {
    pos: [94, 101], picture: '9(008)', value: '00000000',
    dateFormat: Cnab104Const.dateFormat
  },
  /** Fixo: BRL */
  tipoMoeda: {
    pos: [102, 104],
    picture: 'X(003)',
    value: Cnab104TipoMoeda.Real,
    dateFormat: Cnab104Const.dateFormat
  },
  /** Fixo: Zeros(10) */
  quantidadeMoeda: {
    pos: [105, 119],
    picture: '9(010)V99999',
    value: '000000000000000',
  },
  /** Obter do Bigquery */
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  /** Fixo: Brancos(9) */
  numeroDocumentoBanco: {
    pos: [135, 143],
    picture: '9(009)',
    value: '000000000',
  },
  filler2: { pos: [144, 146], picture: 'X(003)', value: '   ' },
  /** Fixo: "01" (à vista) */
  quantidadeParcelas: { pos: [147, 148], picture: '9(002)', value: 1 },
  indicadorBloqueio: {
    pos: [149, 149],
    picture: 'X(001)',
    value: Cnab104IndicadorBloqueio.Nao,
  },
  /** Fixo: dia útil */
  indicadorFormaParcelamento: {
    pos: [150, 150],
    picture: '9(001)',
    value: Cnab104FormaParcelamento.DataFixa,
  },
  /** 
   * Data fixa, Periódico ou Dia útil
   * 
   * Fixo: "5" (5o dia útil do mês);
   * Pois se for obrigatório será a 1a sexta do mês (ou o próximo dia útil caso seja feriado).
   */
  periodoDiaVencimento: { pos: [151, 152], picture: 'X(002)', value: '05' },
  /** Fixo: 00 (parcela única / à vista) */
  numeroParcela: { pos: [153, 154], picture: '9(002)', value: 0 },
  /** 
   * Zeros
   * 
   * Na remessa deve ser preenchido com zeros. Retornado com a data efetiva do lançamento.
   */
  dataEfetivacao: {
    pos: [155, 162], picture: '9(008)', value: '00000000',
    dateFormat: Cnab104Const.dateFormat
  },
  /** Zeros */
  valorRealEfetivado: {
    pos: [163, 177],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  /** Espaços(40) - Histórico infromativo */
  informacao2: {
    pos: [178, 217],
    picture: 'X(040)',
    value: '                                        ',
  },
  /** Fixo: 01 (crédito em conta) */
  finalidadeDOC: {
    pos: [218, 219],
    picture: '9(002)',
    value: Cnab104FinalidadeDoc.CreditoConta,
  },
  /** Espaços(10) */
  usoExclusivoFebraban: {
    pos: [220, 229],
    picture: 'X(010)',
    value: '          ',
  },
  /** Fixo: 0 (nunca emite aviso somente para o remetente) */
  avisoAoFavorecido: {
    pos: [230, 230], picture: '9(001)', value: Cnab104AvisoFavorecido.SemAviso,
  },
  /** Espaços(10) */
  ocorrencias: { pos: [231, 240], picture: 'X(010)', value: '          ' },
};
