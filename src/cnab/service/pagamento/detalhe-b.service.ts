import { Injectable, Logger } from '@nestjs/common';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { asCnabFieldDate } from 'src/cnab/utils/cnab/cnab-field-pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { DetalheB } from '../../entity/pagamento/detalhe-b.entity';
import { DetalheBRepository } from '../../repository/pagamento/detalhe-b.repository';

@Injectable()
export class DetalheBService {
  private logger: Logger = new Logger('DetalheBService', { timestamp: true });

  constructor(private detalheBRepository: DetalheBRepository) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public saveManyIfNotExists(
    dtos: DeepPartial<DetalheB>[],
  ): Promise<DetalheB[]> {
    return this.detalheBRepository.saveManyIfNotExists(dtos);
  }

  public async saveFrom104(
    registro: CnabRegistros104Pgto,
    detalheAUpdated: DetalheA,
  ): Promise<DetalheB> {
    const detalheBRem = await this.detalheBRepository.getOne({
      detalheA: { id: detalheAUpdated.id },
    });
    const detalheB = new DetalheBDTO({
      id: detalheBRem?.id,
      detalheA: { id: detalheAUpdated.id },
      nsr: registro.detalheB.nsr.convertedValue,
      dataVencimento: asCnabFieldDate(registro.detalheB.dataVencimento),
    });
    return await this.detalheBRepository.save(detalheB);
  }

  public async save(dto: DetalheBDTO): Promise<void> {
    await validateDTO(DetalheBDTO, dto);
    await this.detalheBRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheB>,
  ): Promise<Nullable<DetalheB>> {
    return await this.detalheBRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<DetalheB>,
  ): Promise<DetalheB[]> {
    return await this.detalheBRepository.findMany({ where: fields });
  }
}
