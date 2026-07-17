import { IsDateString } from 'class-validator';
import { DeepPartial } from 'typeorm';

export class BigqueryOrdemPagamentoGuardadorDTO {
  constructor(bqOrdem?: DeepPartial<BigqueryOrdemPagamentoGuardadorDTO>) {
    if (bqOrdem !== undefined) {
      Object.assign(this, bqOrdem);
    }
  }

  id: number;

  idCliente: number;

  @IsDateString()
  dataOrdem: string;
  
  idStatusOrdem: number;

  idOrdemPagamentoEstacionamento: number;

  cpfCnpj: string;

  qtdVerificado: number;

  valorUnitarioVerificado: number;

  valorTotalVerificado: number;

  @IsDateString()
  dataPagamento: string;

  @IsDateString()
  dataInclusao: string;

}