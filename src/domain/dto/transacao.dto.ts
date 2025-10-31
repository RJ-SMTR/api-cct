import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Ocorrencia } from 'src/domain/entity/ocorrencia.entity';
import { Lancamento } from 'src/domain/entity/lancamento.entity';
import { DeepPartial } from 'typeorm';
import { Pagador } from '../entity/pagador.entity';

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

  ocorrencias?: DeepPartial<Ocorrencia>[];

  @ValidateIf((obj) => isCreate(obj) && obj.idOrdemPagamento === undefined)
  @IsNotEmpty()
  lancamentos?: Lancamento[] | null;
}
