
export class PagamentoIndevidoDTO  {
 
  constructor(dto: any) {
    this.id = (dto as PagamentoIndevidoDTO).id
    this.dataPagamento = (dto as PagamentoIndevidoDTO).dataPagamento;
    this.dataReferencia= (dto as PagamentoIndevidoDTO).dataReferencia;
    this.nomeFavorecido= (dto as PagamentoIndevidoDTO).nomeFavorecido;
    this.valorPago= (dto as PagamentoIndevidoDTO).valorPago;
    this.valorPagar= (dto as PagamentoIndevidoDTO).valorPagar;
    this.saldoDevedor= (dto as PagamentoIndevidoDTO).saldoDevedor;		   
  }

  id: number;
  dataPagamento: Date;
  dataReferencia: Date;
  nomeFavorecido: string;
  valorPago:number;
  valorPagar:number;		
  saldoDevedor:number;		
}