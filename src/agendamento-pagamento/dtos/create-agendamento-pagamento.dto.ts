import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, Validate, ValidateIf } from 'class-validator';
import { RECORRENCIA_SEMANA } from 'src/cnab/const/recorrencia-semana.const';
import { RecorrenciaSemanaType } from 'src/cnab/const/recorrencia-semana.type';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { dateTransformer } from 'src/utils/transformers/date.transformer';
import { listTransformer } from 'src/utils/transformers/match-list.transformer';
import { numberListTransformer } from 'src/utils/transformers/number-list.transformer';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { IsNumberList } from 'src/utils/validators/is-number-list.validator';
import { MatchesList } from 'src/utils/validators/validate-list.validator';
import { DeepPartial } from 'typeorm';
import { TipoRecorrenciaEnum } from '../tipo-recorrencia.enum';
import { User } from 'src/users/entities/user.entity';
import { AgendamentoPagamento } from '../agendamento-pagamento.entity';

export class CreateAgendamentoPagamentoDTO {
  constructor(agendamento?: DeepPartial<CreateAgendamentoPagamentoDTO>) {
    if (agendamento !== undefined) {
      Object.assign(this, agendamento);
    }
  }

  @ApiProperty()
  @IsDateString()
  @Transform(dateTransformer)
  dataOrdemInicio?: Date;

  @ApiProperty()
  @IsDateString()
  @Transform(dateTransformer)
  dataOrdemFim?: Date;

  @ApiProperty()
  @IsDateString()
  @Transform(dateTransformer)
  dataPagamento?: Date;

  @ApiProperty()
  @IsEnum(TipoRecorrenciaEnum)
  tipoRecorrencia?: TipoRecorrenciaEnum;

  @ApiProperty()
  @ValidateIf(
    (obj: CreateAgendamentoPagamentoDTO) =>
      obj.tipoRecorrencia === TipoRecorrenciaEnum.INTERVALO_DIAS,
  )
  @IsNumberList({ format: 'integer', min: 1, no_symbols: true })
  @Transform(numberListTransformer)
  recorrenciaDias?: number[];

  @ApiProperty()
  @ValidateIf(
    (obj: CreateAgendamentoPagamentoDTO) =>
      obj.tipoRecorrencia === TipoRecorrenciaEnum.INTERVALO_DIAS,
  )
  @MatchesList({ list: RECORRENCIA_SEMANA })
  @Transform(listTransformer)
  recorrenciaSemana?: RecorrenciaSemanaType[];

  @ApiProperty()
  @Validate(IsExist, [ClienteFavorecido, 'id'], {
    message: 'One or more ClienteFavorecido ids not exists',
  })
  @Transform((p) =>
    (p.value as string)
      .split(',')
      .map((i) => ({ id: +i } as DeepPartial<ClienteFavorecido>)),
  )
  clienteFavorecidos: DeepPartial<ClienteFavorecido>;

  user: DeepPartial<User>;
}
