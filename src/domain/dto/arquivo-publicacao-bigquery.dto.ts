import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ItemTransacao } from '../entity/item-transacao.entity';

/**
 * DTO para enviar para a equipe de dados (Bigquery)
 */
export class ArquivoPublicacaoBigqueryDTO {
  constructor(dto: any) {
    this.id = dto.id;
    this.dataHoraGeracaoRetorno = (dto as ArquivoPublicacao).dataGeracaoRetorno;
    this.dataEfetivacao = (dto as ArquivoPublicacao).dataEfetivacao;
    this.dataVencimento = (dto as ArquivoPublicacao).dataVencimento;
    this.isPago = (dto as ArquivoPublicacao).isPago;
    this.valorRealEfetivado = (dto as ArquivoPublicacao).valorRealEfetivado || 0;
    this.dataProcessamento = (dto as ItemTransacao).dataProcessamento;
    this.dataCaptura = (dto as ItemTransacao).dataCaptura;
    this.nomeConsorcio = (dto as ItemTransacao).nomeConsorcio;
    this.valor = (dto as ItemTransacao).valor;
    this.favorecido = (dto as ClienteFavorecido).nome;
    this.idOrdemPagamento = (dto as ItemTransacao).idOrdemPagamento;
    this.idOperadora = (dto as ItemTransacao).idOperadora;
    this.idConsorcio = (dto as ItemTransacao).idConsorcio;
    this.nomeOperadora = (dto as ItemTransacao).nomeOperadora;
    this.dataOrdem = (dto as ItemTransacao).dataOrdem;
    this.ocorrencias = dto.ocorrencias || [];
  }

  id?: number;
  dataHoraGeracaoRetorno: Date | null;
  dataEfetivacao: Date | null;
  dataVencimento: Date | null;
  isPago: boolean;
  /** Se vier nulo no SQL o DTO retorna zero */
  valorRealEfetivado: number;
  dataProcessamento: Date;
  dataCaptura: Date;
  nomeConsorcio: string | null;
  valor: number;
  favorecido: string;
  idOrdemPagamento: string | null;
  idOperadora: string | null;
  idConsorcio: string | null;
  nomeOperadora: string | null;
  dataOrdem: Date;
  ocorrencias: string[];
}
