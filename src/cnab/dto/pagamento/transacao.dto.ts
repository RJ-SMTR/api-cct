import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { DeepPartial } from 'typeorm';
import { TransacaoStatus } from '../../entity/pagamento/transacao-status.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';

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

  @ValidateIf((obj) => isCreate(obj) && obj.lancamentos === undefined)
  @IsNotEmpty()
  idOrdemPagamento?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: Pagador;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  status?: DeepPartial<TransacaoStatus>;

  ocorrencias?: DeepPartial<Ocorrencia>[];

  @ValidateIf((obj) => isCreate(obj) && obj.idOrdemPagamento === undefined)
  @IsNotEmpty()
  lancamentos?: LancamentoEntity[] | null;
}
