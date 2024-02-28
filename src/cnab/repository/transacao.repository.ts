import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { Transacao } from '../entity/transacao.entity';
import { CreateTransacaoDto } from '../interfaces/transacao/create-transacao.dto';
import { UpdateTransacaoDto } from '../interfaces/transacao/update-transacao.dto';

@Injectable()
export class TransacaoRepository {
  private logger: Logger = new Logger('TransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(Transacao)
    private TransacaoRepository: Repository<Transacao>,
  ) {}

  public async create(
    createProfileDto: CreateTransacaoDto,
  ): Promise<Transacao> {
    const createdItem = await this.TransacaoRepository.save(
      this.TransacaoRepository.create(createProfileDto),
    );
    this.logger.log(`Transacao criado: ${createdItem.getLogInfo()}`);
    return createdItem;
  }

  public async update(
    id: number,
    updateDto: UpdateTransacaoDto,
  ): Promise<UpdateResult> {
    const updatePayload = await this.TransacaoRepository.update(
      { id_transacao: id },
      updateDto,
    );
    return updatePayload;
  }

  public async findOne(
    fields: EntityCondition<Transacao> | EntityCondition<Transacao>[],
  ): Promise<NullableType<Transacao>> {
    return await this.TransacaoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<Transacao> | EntityCondition<Transacao>[],
  ): Promise<Transacao[]> {
    return await this.TransacaoRepository.find({
      where: fields,
    });
  }
}
