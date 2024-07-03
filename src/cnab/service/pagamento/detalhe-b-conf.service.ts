import { Injectable, Logger } from '@nestjs/common';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { asCnabFieldDate } from 'src/cnab/utils/cnab/cnab-field-pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial } from 'typeorm';

import { startOfDay } from 'date-fns';
import { DetalheBConf } from 'src/cnab/entity/conference/detalhe-b-conf.entity';
import { DetalheBDTO } from 'src/cnab/dto/pagamento/detalhe-b.dto';
import { DetalheBConfRepository } from 'src/cnab/repository/pagamento/detalhe-b-conf.repository';

@Injectable()
export class DetalheBConfService {
  private logger: Logger = new Logger('DetalheBConfService', { timestamp: true });

  constructor(private detalheBConfRepository: DetalheBConfRepository) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public saveManyIfNotExists(
    dtos: DeepPartial<DetalheBConf>[],
  ): Promise<DetalheBConf[]> {
    return this.detalheBConfRepository.saveManyIfNotExists(dtos);
  }

  public async saveFrom104(
    registro: CnabRegistros104Pgto,
    detalheAUpdated: DetalheA,
  ): Promise<DetalheBConf> {
    const DetalheBConfRem = await this.detalheBConfRepository.getOne({
      detalheA: { id: detalheAUpdated.id },
    });
    const DetalheBConf = new DetalheBDTO({
      id: DetalheBConfRem?.id,
      detalheA: { id: detalheAUpdated.id },
      nsr: registro.detalheB.nsr.convertedValue,
      dataVencimento: startOfDay(asCnabFieldDate(registro.detalheB.dataVencimento)),
    });
    return await this.detalheBConfRepository.save(DetalheBConf);
  }

  public async save(dto: DetalheBDTO): Promise<void> {
    await validateDTO(DetalheBDTO, dto);
    await this.detalheBConfRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheBConf>,
  ): Promise<Nullable<DetalheBConf>> {
    return await this.detalheBConfRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<DetalheBConf>,
  ): Promise<DetalheBConf[]> {
    return await this.detalheBConfRepository.findMany({ where: fields });
  }
}
