import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, Repository } from 'typeorm';

@Injectable()
export class OcorrenciaRepository {
  private logger = new CustomLogger(OcorrenciaRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(Ocorrencia)
    private ocorrenciaRepository: Repository<Ocorrencia>,
  ) {}

  public async save(dto: DeepPartial<Ocorrencia>): Promise<Ocorrencia> {
    const createdOcorrencia = this.ocorrenciaRepository.create(dto);
    return this.ocorrenciaRepository.save(createdOcorrencia);
  }

  async insert(ocorrencias: DeepPartial<Ocorrencia>[]) {
    return await this.ocorrenciaRepository.insert(ocorrencias);
  }

  public async findOne(fields: EntityCondition<Ocorrencia>): Promise<Nullable<Ocorrencia>> {
    return await this.ocorrenciaRepository.findOne({
      where: fields,
    });
  }

  public async findMany(options: FindManyOptions<Ocorrencia>): Promise<Ocorrencia[]> {
    return await this.ocorrenciaRepository.find(options);
  }

  public async findAll(): Promise<Ocorrencia[]> {
    return await this.ocorrenciaRepository.find({});
  }

  public async getAll(): Promise<Ocorrencia[]> {
    return await this.ocorrenciaRepository.find({});
  }
}
