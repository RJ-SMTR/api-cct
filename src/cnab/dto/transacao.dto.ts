import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Pagador } from '../entity/pagador.entity';
import { DeepPartial } from 'typeorm';

function isCreate(object: TransacaoDTO): boolean {
  return object.id === undefined;
}

export class TransacaoDTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataOrdem?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataPagamento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeConsorcio?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeOperadora?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  servico?: string;
  
  @ValidateIf(isCreate)
  @IsNotEmpty()
  idOrdemRessarcimento?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeTransacaoRateioCredito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorRateioCredito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeTransacaoRateioDebito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorRateioDebito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeTotalTransacao?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorTotalTransacaoBruto?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorDescontoTaxa?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorTotalTransacaoLiquido?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeTotalTransacaoCaptura?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorTotalTransacaoCaptura?: number;

  @ValidateIf(isCreate)
  indicadorOrdemValida?: boolean;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: DeepPartial<Pagador>;

}