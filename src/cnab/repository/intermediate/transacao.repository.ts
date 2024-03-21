import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { Transacao } from '../../entity/intermediate/transacao.entity';
import { TransacaoDTO } from '../../dto/intermediate/transacao.dto';
import { TransacaoStatusEnum } from '../../enums/intermediate/transacao-status.enum';

@Injectable()
export class TransacaoRepository {
  private logger: Logger = new Logger('TransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(Transacao)
    private transacaoRepository: Repository<Transacao>,
  ) { }

  public async save(dto: TransacaoDTO): Promise<Transacao> {
    return this.transacaoRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<Transacao> | EntityCondition<Transacao>[],
  ): Promise<Nullable<Transacao>> {
    return await this.transacaoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.find({});
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.find({});
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(): Promise<Transacao[]> {
    return await this.transacaoRepository.find({
      where: {
        status: { id: TransacaoStatusEnum.created }
      }
    });
  }
}
