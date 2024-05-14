export class ArquivoPublicacaoReturnDTO {
  constructor(dto?: ArquivoPublicacaoReturnDTO) {
    if (dto) {
      this.id = dto.id;
      this.dataGeracaoRetorno = dto.dataGeracaoRetorno;
      this.horaGeracaoRetorno = dto.horaGeracaoRetorno;
      this.dataEfetivacao = dto.dataEfetivacao;
      this.dataVencimento = dto.dataVencimento;
      this.isPago = dto.isPago;
      this.valorRealEfetivado = dto.valorRealEfetivado;
      this.dataProcessamento = dto.dataProcessamento;
      this.dataCaptura = dto.dataCaptura;
      this.nomeConsorcio = dto.nomeConsorcio;
      this.valor = Number(dto.valor);
      this.favorecido = dto.favorecido;
      this.idOrdemPagamento = dto.idOrdemPagamento;
      this.idOperadora = dto.idOperadora;
      this.idConsorcio = dto.idConsorcio;
      this.nomeOperadora = dto.nomeOperadora;
      this.dataOrdem = dto.dataOrdem;
      this.ocorrencias = dto.ocorrencias;
    }
  }

  id?: number;
  dataGeracaoRetorno: Date;
  horaGeracaoRetorno: Date;
  dataEfetivacao: Date;
  dataVencimento: Date;
  isPago: boolean;
  valorRealEfetivado: number;
  dataProcessamento: Date;
  dataCaptura: Date;
  nomeConsorcio: string;
  valor: number;
  favorecido: string;
  idOrdemPagamento: number;
  idOperadora: number;
  idConsorcio: number;
  nomeOperadora: string;
  /** Filtros: dt_inicio, dt_fim */
  dataOrdem: Date;
  ocorrencias: string[];
}
