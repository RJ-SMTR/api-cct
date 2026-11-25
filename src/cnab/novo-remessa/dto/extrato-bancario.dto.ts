/** Um crédito efetivado na conta bancária do favorecido (um Detalhe A pago). */
export class ExtratoBancarioLancamentoDto {
  detalheAId: number;
  ordemPagamentoAgrupadoId: number;
  /** Data do crédito: dataEfetivacao do Detalhe A (ou dataVencimento quando o banco não informou). */
  dataCredito: string;
  dataEfetivacao: string | null;
  dataVencimento: string | null;
  /** Data da tentativa de pagamento (ordem agrupada). */
  dataTentativaPagamento: string | null;
  /** Valor efetivamente creditado (valorRealEfetivado, ou valorLancamento quando ausente). */
  valorCreditado: number;
  valorLancamento: number;
  valorRealEfetivado: number | null;
  /** Saldo acumulado dos créditos do período, em ordem cronológica. */
  saldoAcumulado: number;
  statusRemessa: number;
  descricaoStatus: string;
  motivoStatusRemessa: string | null;
  /** Conta de destino usada no pagamento (snapshot do histórico). */
  contaDestino: {
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    digito: string | null;
    tipoConta: string | null;
  };
  /** Origem do pagamento. */
  pagador: { nome: string | null; documento: string | null };
  remessa: {
    nsa: number | null;
    arquivoRemessa: string | null;
    arquivoRetorno: string | null;
    dataGeracao: string | null;
    formaLancamento: string | null;
  };
  documento: { numeroDocumentoEmpresa: string | null; numeroDocumentoBanco: string | null; nsr: number | null };
  ocorrencias: string | null;
  /** Ordens de pagamento que compõem o crédito. */
  ordens: {
    quantidade: number;
    dataOrdemInicio: string | null;
    dataOrdemFim: string | null;
    valorOrdens: number | null;
    consorcios: string | null;
    quantidadeGuardador: number;
    valorGuardador: number | null;
  };
}

export class ExtratoBancarioDto {
  userId: number;
  dataInicio: string;
  dataFim: string;
  contaAtual: { banco: string | null; agencia: string | null; conta: string | null; digito: string | null; tipoConta: string | null };
  totalCreditado: number;
  quantidadeCreditos: number;
  maiorCredito: number;
  menorCredito: number;
  lancamentos: ExtratoBancarioLancamentoDto[];
}
