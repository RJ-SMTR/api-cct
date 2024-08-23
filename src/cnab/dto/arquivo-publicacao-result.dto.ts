
/**
 * DTO para enviar para a equipe de dados (Bigquery)
 */
export class ArquivoPublicacaoBigqueryDTO {
  constructor(dto: any) {
    this.id = dto.id;
    this.dataHoraGeracaoRetorno = dto.dataGeracaoRetorno;
    this.dataEfetivacao = dto.dataEfetivacao;
    this.dataVencimento = dto.dataVencimento;
    this.isPago = dto.isPago;
    this.valorRealEfetivado = dto.valorRealEfetivado || 0;
    this.dataProcessamento = dto.dataProcessamento;
    this.dataCaptura = dto.dataCaptura;
    this.nomeConsorcio = dto.nomeConsorcio;
    this.valor = dto.valor;
    this.favorecido = dto.nome;
    this.idOrdemPagamento = dto.idOrdemPagamento;
    this.idOperadora = dto.idOperadora;
    this.idConsorcio = dto.idConsorcio;
    this.nomeOperadora = dto.nomeOperadora;
    this.dataOrdem = dto.dataOrdem;
    this.ocorrencias = dto.ocorrencias || [];
  }

  id?: number;
  dataHoraGeracaoRetorno: Date;
  dataEfetivacao: Date | null;
  dataVencimento: Date;
  isPago: boolean;
  /** Se vier nulo no SQL o DTO retorna zero */
  valorRealEfetivado: number;
  dataProcessamento: Date;
  dataCaptura: Date;
  nomeConsorcio: string;
  valor: number;
  favorecido: string;
  idOrdemPagamento: string;
  idOperadora: string;
  idConsorcio: string;
  nomeOperadora: string;
  dataOrdem: Date;
  ocorrencias: string[];
}
