import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtratoHeaderLote } from 'src/cnab/entity/extrato/extrato-header-lote.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, FindOneOptions, Repository } from 'typeorm';

@Injectable()
export class ExtratoHeaderLoteRepository {
  private logger: Logger = new Logger('HeaderLoteRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ExtratoHeaderLote)
    private extratoHeaderLoteRepository: Repository<ExtratoHeaderLote>,
  ) { }

  public async save(obj: DeepPartial<ExtratoHeaderLote>): Promise<ExtratoHeaderLote> {
    return await this.extratoHeaderLoteRepository.save(obj);
  }

  public async findOne(options: FindOneOptions<ExtratoHeaderLote>): Promise<Nullable<ExtratoHeaderLote>> {
    return await this.extratoHeaderLoteRepository.findOne(options);
  }

  public async getOne(options: FindOneOptions<ExtratoHeaderLote>): Promise<ExtratoHeaderLote> {
    try {
      const header = await this.extratoHeaderLoteRepository.findOneOrFail(options);
      return header;
    } catch (error) {
      const fieldsStr = Object.values(options?.where || []).reduce((l, i) => [...l, String(i)], []);
      throw CommonHttpException.invalidField(
        'ExtratoHeaderLote',
        fieldsStr.join(','),
        { errorMessage: (error as Error)?.message }
      )
    }
  }

  public async findMany(options: FindManyOptions<ExtratoHeaderLote>): Promise<ExtratoHeaderLote[]> {
    return await this.extratoHeaderLoteRepository.find(options);
  }
}
