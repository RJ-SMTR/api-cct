import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, InsertResult, Not, Repository } from 'typeorm';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { TransacaoDTO } from '../../dto/pagamento/transacao.dto';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { asString } from 'src/utils/pipe-utils';

@Injectable()
export class TransacaoRepository {
  private logger: Logger = new Logger('TransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(Transacao)
    private transacaoRepository: Repository<Transacao>,
  ) { }

  /**
   * Save Transacao if NSA not exists
   */
  public async saveDTOIfNotExists(dto: TransacaoDTO): Promise<SaveIfNotExists<Transacao>> {
    await validateDTO(TransacaoDTO, dto);
    const transacao = await this.findOne({ idOrdemPagamento: asString(dto.idOrdemPagamento) });
    if (transacao) {
      return {
        isNewItem: false,
        item: transacao,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.transacaoRepository.save(dto),
      };
    }
  }

  /**
   * Bulk save
   */
  public async insert(dtos: DeepPartial<Transacao>[]): Promise<InsertResult> {
    return this.transacaoRepository.insert(dtos);
  }

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

  public async findMany(options: FindManyOptions<Transacao>): Promise<Transacao[]> {
    return await this.transacaoRepository.find(options);
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
        status: { id: Not(TransacaoStatusEnum.used) }
      }
    });
  }
}
