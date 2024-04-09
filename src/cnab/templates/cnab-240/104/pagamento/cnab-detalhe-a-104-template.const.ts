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

/**
 * PAGAMENTO DE SALÁRIOS, PAGAMENTO/CRÉDITO A FORNECEDOR E AUTOPAGAMENTO E DÉBITO AUTOMÁTICO
 * 
 * @version v032 micro - FEV/2024
 */
export const cnabDetalheA104Template: CnabDetalheA_104 = {
  /** A.01 Fixo: 104 (Caixa) */
  codigoBanco: {
    pos: [1, 3],
    picture: '9(003)',
    value: '104',
    ...Cnab.insert.d(),
  },
  /** A.02 Automático */
  loteServico: {
    pos: [4, 7],
    picture: '9(004)',
    value: '0000',
    ...Cnab.insert.number(),
  },
  /** A.03  */
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.DetalheSegmento,
    ...Cnab.insert.number(),
  },
  /** A.04 Automático */
  nsr: {
    pos: [9, 13],
    picture: '9(005)',
    value: '00000',
    ...Cnab.insert.number(),
  },
  /** A.05 */
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.A,
    ...Cnab.insert.string(),
  },
  /** A.06 Depende das nossas necessidades. */
  tipoMovimento: {
    pos: [15, 15], picture: '9(001)', value: Cnab104TipoMovimento.Inclusao,
    ...Cnab.insert.d(),
  },
  /** A.07 Fixo: 00 */
  codigoInstrucaoMovimento: {
    pos: [16, 17], picture: '9(002)', value: '00',
    ...Cnab.insert.d(),
  },
  /** 
   * A.08
   */
  camaraCompensacao: {
    pos: [18, 20], picture: '9(003)',
    value: Cnab104CamaraCompensacao.DocEOrdemPagamento,
    ...Cnab.insert.d(),
  },
  /** A.09 Favorecido */
  codigoBancoDestino: {
    pos: [21, 23], picture: '9(003)', value: '000',
    ...Cnab.insert.d(),
  },
  /** A.10 Favorecido */
  codigoAgenciaDestino: {
    pos: [24, 28], picture: '9(005)', value: '00000',
    ...Cnab.insert.d(),
  },
  /** A.11 Favorecido */
  dvAgenciaDestino: {
    pos: [29, 29], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** A.12 Favorecido */
  contaCorrenteDestino: {
    pos: [30, 41],
    picture: '9(012)',
    value: '000000000000',
    ...Cnab.insert.d(),
  },
  /** A.13 Favorecido */
  dvContaDestino: {
    pos: [42, 42], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** A.14 Fixo: Branco (1) */
  dvAgenciaContaDestino: {
    pos: [43, 43], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** A.15 Favorecido */
  nomeTerceiro: {
    pos: [44, 73],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d(),
  },
  /** 
   * A.16
   * 
   * Número Documento atribuído pela Empresa - obtido do banco
   * 
   * Detalhes: A, J, O, N
   */
  numeroDocumentoEmpresa: {
    pos: [74, 79], picture: '9(006)', value: '000000',
    ...Cnab.insert.number(),
  },
  /** A.17 */
  filler: {
    pos: [80, 92], picture: 'X(013)', value: '             ',
    ...Cnab.insert.d(),
  },
  /** A.18 Get from favorecido.cpfCnpj */
  tipoContaFinalidadeTed: {
    pos: [93, 93], picture: 'X(001)', value: ' ',
    ...Cnab.insert.d(),
  },
  /** A.19 DDMMAAAA */
  dataVencimento: {
    pos: [94, 101], picture: '9(008)', value: '00000000',
    ...Cnab.insert.date(),
  },
  /** A.20 Fixo: BRL */
  tipoMoeda: {
    pos: [102, 104],
    picture: 'X(003)',
    value: Cnab104TipoMoeda.Real,
    ...Cnab.insert.d(),
  },
  /** A.21 Fixo: Zeros(10) */
  quantidadeMoeda: {
    pos: [105, 119],
    picture: '9(010)V99999',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  /** A.22 Obter do Bigquery */
  valorLancamento: {
    pos: [120, 134],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  /** 
   * A.23 Fixo: Brancos(9)
   * 
   * Alteração no Segmento A da informação “Picture” do campo A.23 de ‘9(009)’ para ‘X(009)’.
   * 
   * Preencher com brancos. Retornado com brancos.
   */
  numeroDocumentoBanco: {
    pos: [135, 143],
    picture: 'X(009)',
    value: '         ',
    ...Cnab.insert.nullableString(),
  },
  /** A.24 */
  filler2: {
    pos: [144, 146], picture: 'X(003)', value: '   ',
    ...Cnab.insert.d(),
  },
  /** A.25 Fixo: "01" (à vista) */
  quantidadeParcelas: {
    pos: [147, 148], picture: '9(002)', value: 1,
    ...Cnab.insert.number(),
  },
  /** A.26 */
  indicadorBloqueio: {
    pos: [149, 149],
    picture: 'X(001)',
    value: Cnab104IndicadorBloqueio.Nao,
    ...Cnab.insert.d(),
  },
  /** A.27 Fixo: dia útil */
  indicadorFormaParcelamento: {
    pos: [150, 150],
    picture: '9(001)',
    value: Cnab104FormaParcelamento.DataFixa,
    ...Cnab.insert.d(),
  },
  /** 
   * A.28
   * 
   * Data fixa, Periódico ou Dia útil
   * 
   * Fixo: "5" (5o dia útil do mês);
   * Pois se for obrigatório será a 1a sexta do mês (ou o próximo dia útil caso seja feriado).
   */
  periodoDiaVencimento: {
    pos: [151, 152], picture: 'X(002)', value: '05',
    ...Cnab.insert.d(),
  },
  /** A.29 Fixo: 00 (parcela única / à vista) */
  numeroParcela: {
    pos: [153, 154], picture: '9(002)', value: 0,
    ...Cnab.insert.number(),
  },
  /** 
   * A.30
   * 
   * Zeros
   * 
   * Na remessa deve ser preenchido com zeros. Retornado com a data efetiva do lançamento.
   */
  dataEfetivacao: {
    pos: [155, 162], picture: '9(008)', value: '00000000',
    ...Cnab.insert.nullableDate(),
  },
  /** A.31 Zeros */
  valorRealEfetivado: {
    pos: [163, 177],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.number(),
  },
  /** A.32 Espaços(40) - Histórico infromativo */
  informacao2: {
    pos: [178, 217],
    picture: 'X(040)',
    value: '                                        ',
    ...Cnab.insert.d(),
  },
  /** A.33 Fixo: 01 (crédito em conta) */
  finalidadeDOC: {
    pos: [218, 219],
    picture: '9(002)',
    value: Cnab104FinalidadeDoc.CreditoConta,
    ...Cnab.insert.d(),
  },
  /** A.34 Espaços(10) */
  usoExclusivoFebraban: {
    pos: [220, 229],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
  /** A.35 Fixo: 0 (nunca emite aviso somente para o remetente) */
  avisoAoFavorecido: {
    pos: [230, 230],
    picture: '9(001)',
    value: Cnab104AvisoFavorecido.SemAviso,
    ...Cnab.insert.d(),
  },
  /** A.36 Espaços(10) */
  ocorrencias: {
    pos: [231, 240],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
};
