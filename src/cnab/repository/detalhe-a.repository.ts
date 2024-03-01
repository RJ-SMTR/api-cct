<<<<<<< HEAD
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
    Repository,
    UpdateResult
} from 'typeorm';
import { DetalheA } from '../entity/detalhe-a.entity';
import { DetalheADTO } from '../dto/detalhe-a.dto';


@Injectable()
export class DetalheARepository {
    private logger: Logger = new Logger('DetalheARepository', { timestamp: true });

    constructor(
        @InjectRepository(DetalheA)
        private DetalheARepository: Repository<DetalheA>,
    ) { }

    public async save(dto: DetalheADTO): Promise<DetalheA> {
       return await this.DetalheARepository.save(dto);               
    }  

    public async findOne(
        fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
    ): Promise<NullableType<DetalheA>> {
        return await this.DetalheARepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
    ): Promise<DetalheA[]> {
        return await this.DetalheARepository.find({
            where: fields,
        });
    }

}
=======
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { SaveDetalheADTO } from '../dto/save-detalhe-a.dto';
import { DetalheA } from '../entity/detalhe-a.entity';

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheA)
    private DetalheARepository: Repository<DetalheA>,
  ) {}

  async save(dto: SaveDetalheADTO): Promise<void> {
    if (dto.id_detalhe_a === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id_detalhe_a, dto);
    }
  }

  async create(createProfileDto: SaveDetalheADTO): Promise<DetalheA> {
    const createdUser = await this.DetalheARepository.save(
      this.DetalheARepository.create(createProfileDto),
    );
    this.logger.log(`DetalheA criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async update(id: number, updateDto: SaveDetalheADTO): Promise<UpdateResult> {
    const updatePayload = await this.DetalheARepository.update(
      { id_cliente_favorecido: id },
      updateDto,
    );
    const updatedItem = new DetalheA({
      id_cliente_favorecido: id,
      ...updateDto,
    });
    this.logger.log(`DetalheA atualizado: ${updatedItem.getLogInfo()}`);
    return updatePayload;
  }

  public async findOne(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<NullableType<DetalheA>> {
    return await this.DetalheARepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<DetalheA[]> {
    return await this.DetalheARepository.find({
      where: fields,
    });
  }
}
>>>>>>> 7733f18adc3b550c8f39c3a515f35364c9082856
