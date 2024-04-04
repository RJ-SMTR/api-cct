import { Injectable, Logger } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { DetalheBRepository } from '../../repository/pagamento/detalhe-b.repository';
import { DetalheB } from '../../entity/pagamento/detalhe-b.entity';
import { validateDTO } from 'src/utils/validation-utils';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { asCnabFieldDate } from 'src/cnab/utils/cnab/cnab-field-pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';

@Injectable()
export class DetalheBService {
  private logger: Logger = new Logger('DetalheBService', { timestamp: true });

  constructor(private detalheBRepository: DetalheBRepository) { }

  public async saveFrom104(registro: CnabRegistros104Pgto, detalheA: DetalheA
  ): Promise<SaveIfNotExists<DetalheB>> {
    const detalheB = new DetalheBDTO({
      detalheA: { id: detalheA.id },
      nsr: registro.detalheB.nsr.convertedValue,
      dataVencimento: asCnabFieldDate(registro.detalheB.dataVencimento),
    });
    return await this.detalheBRepository.saveIfNotExists(detalheB);
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
    return await this.detalheBRepository.findMany(fields);
  }
}
