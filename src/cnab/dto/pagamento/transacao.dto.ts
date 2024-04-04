import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { DeepPartial } from 'typeorm';
import { TransacaoStatus } from '../../entity/pagamento/transacao-status.entity';
import { TransacaoOcorrencia } from 'src/cnab/entity/pagamento/transacao-ocorrencia.entity';

function isCreate(object: TransacaoDTO): boolean {
  return object.id === undefined;
}

export class TransacaoDTO {
  constructor(dto?: TransacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
  
  id?: number;
  dataOrdem?: Date;
  dataPagamento?: Date | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  idOrdemPagamento?: string;
  
  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: Pagador;
  
  @ValidateIf(isCreate)
  @IsNotEmpty()
  status?: DeepPartial<TransacaoStatus>;
  
  ocorrencias?: DeepPartial<TransacaoOcorrencia>[];
}