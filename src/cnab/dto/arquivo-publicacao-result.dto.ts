import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { Ocorrencia } from '../entity/pagamento/ocorrencia.entity';

export class ArquivoPublicacaoResultDTO {
  constructor(
    dto: ArquivoPublicacao,
    ocorrencias: Ocorrencia[],
  ) {
    this.id = dto.id;
    this.dataHoraGeracaoRetorno = (dto as any).dataGeracaoRetorno;
    this.dataEfetivacao = dto.dataEfetivacao as Date;
    this.dataVencimento = dto.dataVencimento as Date;
    this.isPago = dto.isPago;
    this.valorRealEfetivado = dto.valorRealEfetivado || 0;
    this.dataProcessamento = dto.itemTransacao.dataProcessamento;
    this.dataCaptura = dto.itemTransacao.dataCaptura;
    this.nomeConsorcio = dto.itemTransacao.nomeConsorcio as string;
    this.valor = dto.itemTransacao.valor;
    this.favorecido = dto.itemTransacao.clienteFavorecido.nome;
    this.idOrdemPagamento = dto.itemTransacao.idOrdemPagamento as string;
    this.idOperadora = dto.itemTransacao.idOperadora as string;
    this.idConsorcio = dto.itemTransacao.idConsorcio as string;
    this.nomeOperadora = dto.itemTransacao.nomeOperadora as string;
    this.dataOrdem = dto.itemTransacao.dataOrdem;
    this.ocorrencias = ocorrencias.map((i) => i.message);
  }

  id?: number;
  dataHoraGeracaoRetorno: Date;
  dataEfetivacao: Date;
  dataVencimento: Date;
  isPago: boolean;
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
  /** Filtros: dt_inicio, dt_fim */
  dataOrdem: Date;
  ocorrencias: string[];
}
