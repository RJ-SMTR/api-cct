import { Cnab } from 'src/cnab/const/cnab.const';
import { Cnab104AvisoFavorecido } from 'src/cnab/enums/104/cnab-104-aviso-favorecido.enum';
import { Cnab104CamaraCompensacao } from 'src/cnab/enums/104/cnab-104-camara-compensacao.enum';
import { Cnab104FinalidadeDoc } from 'src/cnab/enums/104/cnab-104-finalidade-doc.enum';
import { Cnab104FormaParcelamento } from 'src/cnab/enums/104/cnab-104-forma-parcelamento.enum';
import { Cnab104IndicadorBloqueio } from 'src/cnab/enums/104/cnab-104-indicador-bloqueio.enum';
import { Cnab104TipoMoeda } from 'src/cnab/enums/104/cnab-104-tipo-moeda.enum';
import { Cnab104TipoMovimento } from 'src/cnab/enums/104/cnab-104-tipo-movimento.enum';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabCodigoSegmento } from 'src/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabDetalheA_104 } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';

export const cnabDetalheA104Template: CnabDetalheA_104 = {
  /** Fixo: 104 (Caixa) */
  codigoBanco: {
    pos: [1, 3],
    picture: '9(003)',
    value: '104',
    ...Cnab.insert.d(),
  },
  /** Automático */
  loteServico: {
    pos: [4, 7],
    picture: '9(004)',
    value: '0000',
    ...Cnab.insert.number(),
  },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.DetalheSegmento,
    ...Cnab.insert.number(),
  },
  /** Automático */
  nsr: {
    pos: [9, 13],
    picture: '9(005)',
    value: '00000',
    ...Cnab.insert.number(),
  },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.A,
    ...Cnab.insert.string(),
  },
  /** Depende das nossas necessidades. */
  tipoMovimento: {
    pos: [15, 15], picture: '9(001)', value: Cnab104TipoMovimento.Inclusao,
    ...Cnab.insert.d(),
  },
  /** Fixo: 00 */
  codigoInstrucaoMovimento: {
    pos: [16, 17], picture: '9(002)', value: '00',
    ...Cnab.insert.d(),
  },
  /** 
   * TODO: Qual usar? - Anotado
   * 
   * Entendemos que é Doc e OP, vamos confirmar.
   */
  camaraCompensacao: {
    pos: [18, 20], picture: '9(003)',
    value: Cnab104CamaraCompensacao.DocEOrdemPagamento,
    ...Cnab.insert.d(),
  },
  /** Favorecido */
  codigoBancoDestino: {
    pos: [21, 23], picture: '9(003)', value: '000',
    ...Cnab.insert.d(),
  },
  /** Favorecido */
  codigoAgenciaDestino: {
    pos: [24, 28], picture: '9(005)', value: '00000',
    ...Cnab.insert.d(),
  },
  /** Favorecido */
  dvAgenciaDestino: {
    pos: [29, 29], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** Favorecido */
  contaCorrenteDestino: {
    pos: [30, 41],
    picture: '9(012)',
    value: '000000000000',
    ...Cnab.insert.d(),
  },
  /** Favorecido */
  dvContaDestino: {
    pos: [42, 42], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** Fixo: Branco (1) */
  dvAgenciaContaDestino: {
    pos: [43, 43], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** Favorecido */
  nomeTerceiro: {
    pos: [44, 73],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d(),
  },
  /** 
   * Número Documento atribuído pela Empresa - obtido do banco
   * 
   * Detalhes: A, J, O, N
   */
  numeroDocumentoEmpresa: {
    pos: [74, 79], picture: '9(006)', value: '000000',
    ...Cnab.insert.number(),
  },
  filler: {
    pos: [80, 92], picture: 'X(013)', value: '             ',
    ...Cnab.insert.d(),
  },
  /** Obter de favorecido.cpfCnpj */
  tipoContaFinalidadeTed: {
    pos: [93, 93], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** DDMMAAAA */
  dataVencimento: {
    pos: [94, 101], picture: '9(008)', value: '00000000',
    ...Cnab.insert.date(),
  },
  /** Fixo: BRL */
  tipoMoeda: {
    pos: [102, 104],
    picture: 'X(003)',
    value: Cnab104TipoMoeda.Real,
    ...Cnab.insert.d(),
  },
  /** Fixo: Zeros(10) */
  quantidadeMoeda: {
    pos: [105, 119],
    picture: '9(010)V99999',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  /** Obter do Bigquery */
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  /** Fixo: Brancos(9) */
  numeroDocumentoBanco: {
    pos: [135, 143],
    picture: '9(009)',
    value: '000000000',
    ...Cnab.insert.d(),
  },
  filler2: {
    pos: [144, 146], picture: 'X(003)', value: '   ',
    ...Cnab.insert.d(),
  },
  /** Fixo: "01" (à vista) */
  quantidadeParcelas: {
    pos: [147, 148], picture: '9(002)', value: 1,
    ...Cnab.insert.number(),
  },
  indicadorBloqueio: {
    pos: [149, 149],
    picture: 'X(001)',
    value: Cnab104IndicadorBloqueio.Nao,
    ...Cnab.insert.d(),
  },
  /** Fixo: dia útil */
  indicadorFormaParcelamento: {
    pos: [150, 150],
    picture: '9(001)',
    value: Cnab104FormaParcelamento.DataFixa,
    ...Cnab.insert.d(),
  },
  /** 
   * Data fixa, Periódico ou Dia útil
   * 
   * Fixo: "5" (5o dia útil do mês);
   * Pois se for obrigatório será a 1a sexta do mês (ou o próximo dia útil caso seja feriado).
   */
  periodoDiaVencimento: {
    pos: [151, 152], picture: 'X(002)', value: '05',
    ...Cnab.insert.d(),
  },
  /** Fixo: 00 (parcela única / à vista) */
  numeroParcela: {
    pos: [153, 154], picture: '9(002)', value: 0,
    ...Cnab.insert.number(),
  },
  /** 
   * Zeros
   * 
   * Na remessa deve ser preenchido com zeros. Retornado com a data efetiva do lançamento.
   */
  dataEfetivacao: {
    pos: [155, 162], picture: '9(008)', value: '00000000',
    ...Cnab.insert.nullableDate(),
  },
  /** Zeros */
  valorRealEfetivado: {
    pos: [163, 177],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  /** Espaços(40) - Histórico infromativo */
  informacao2: {
    pos: [178, 217],
    picture: 'X(040)',
    value: '                                        ',
    ...Cnab.insert.d(),
  },
  /** Fixo: 01 (crédito em conta) */
  finalidadeDOC: {
    pos: [218, 219],
    picture: '9(002)',
    value: Cnab104FinalidadeDoc.CreditoConta,
    ...Cnab.insert.d(),
  },
  /** Espaços(10) */
  usoExclusivoFebraban: {
    pos: [220, 229],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
  /** Fixo: 0 (nunca emite aviso somente para o remetente) */
  avisoAoFavorecido: {
    pos: [230, 230],
    picture: '9(001)',
    value: Cnab104AvisoFavorecido.SemAviso,
    ...Cnab.insert.d(),
  },
  /** Espaços(10) */
  ocorrencias: {
    pos: [231, 240],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
};
