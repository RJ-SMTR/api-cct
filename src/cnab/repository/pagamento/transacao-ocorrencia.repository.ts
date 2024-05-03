import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransacaoOcorrencia } from 'src/cnab/entity/pagamento/transacao-ocorrencia.entity';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, Repository } from 'typeorm';

@Injectable()
export class TransacaoOcorrenciaRepository {
  private logger: Logger = new Logger(TransacaoOcorrenciaRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(TransacaoOcorrencia)
    private transacaoOcorrenciaRepository: Repository<TransacaoOcorrencia>,
  ) {}

  public async save(
    dto: DeepPartial<TransacaoOcorrencia>,
  ): Promise<TransacaoOcorrencia> {
    return this.transacaoOcorrenciaRepository.save(dto);
  }

  async insert(ocorrencias: DeepPartial<TransacaoOcorrencia>[]) {
    return await this.transacaoOcorrenciaRepository.insert(ocorrencias);
  }

  public async findOne(
    fields: EntityCondition<TransacaoOcorrencia>,
  ): Promise<Nullable<TransacaoOcorrencia>> {
    return await this.transacaoOcorrenciaRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    options: FindManyOptions<TransacaoOcorrencia>,
  ): Promise<TransacaoOcorrencia[]> {
    return await this.transacaoOcorrenciaRepository.find(options);
  }

  public async findAll(): Promise<TransacaoOcorrencia[]> {
    return await this.transacaoOcorrenciaRepository.find({});
  }

  public async getAll(): Promise<TransacaoOcorrencia[]> {
    return await this.transacaoOcorrenciaRepository.find({});
  }
}
