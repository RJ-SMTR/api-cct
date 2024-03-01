import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { Transacao } from '../entity/transacao.entity';
import { SaveTransacaoDTO } from '../dto/save-transacao.dto';

@Injectable()
export class TransacaoRepository {
  private logger: Logger = new Logger('TransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(Transacao)
    private transacaoRepository: Repository<Transacao>,
  ) {}

  public async save(dto: SaveTransacaoDTO): Promise<number> {
    if (dto.id_transacao === undefined) {
      const createdItem = await this.create(dto);
      return createdItem.id_transacao;
    } else {
      await this.update(dto.id_transacao, dto);
      return dto.id_transacao;
    }
  }

  private async create(createProfileDto: SaveTransacaoDTO): Promise<Transacao> {
    const createdItem = await this.transacaoRepository.save(
      this.transacaoRepository.create(createProfileDto),
    );
    this.logger.log(`Transacao criado: ${createdItem.getLogInfo()}`);
    return createdItem;
  }

  private async update(
    id: number,
    updateDto: SaveTransacaoDTO,
  ): Promise<UpdateResult> {
    const updatePayload = await this.transacaoRepository.update(
      { id_transacao: id },
      updateDto,
    );
    const updatedItem = new Transacao({ id_transacao: id, ...updateDto });
    this.logger.log(`Transacao atualizado: ${updatedItem.getLogInfo()}`);
    return updatePayload;
  }

  public async findOne(
    fields: EntityCondition<Transacao> | EntityCondition<Transacao>[],
  ): Promise<Nullable<Transacao>> {
    return await this.transacaoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<Transacao> | EntityCondition<Transacao>[],
  ): Promise<Transacao[]> {
    return await this.transacaoRepository.find({
      where: fields,
    });
  }
}
