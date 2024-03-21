import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { DeepPartial, FindManyOptions, FindOneOptions, Repository } from 'typeorm';

@Injectable()
export class ExtratoHeaderArquivoRepository {
  [x: string]: any;
  private logger: Logger = new Logger('ExtratoHeaderArquivoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ExtratoHeaderArquivo)
    private headerArquivoRepository: Repository<ExtratoHeaderArquivo>,
  ) { }

  /**
   * If has existing id, update, otherwise save.
   */
  public async save(obj: DeepPartial<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    return await this.headerArquivoRepository.save(obj);
  }

  public async getOne(options: FindOneOptions<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    try {
      const header = await this.headerArquivoRepository.findOneOrFail(options);
      return header;
    } catch (error) {
      const fieldsStr = Object.values(options?.where || []).reduce((l, i) => [...l, String(i)], []);
      throw CommonHttpException.invalidField(
        'ExtratoHeaderArquivo',
        fieldsStr.join(','),
        { errorMessage: (error as Error)?.message }
      )
    }
  }

  public async findOne(options: FindOneOptions<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo | null> {
    return await this.headerArquivoRepository.findOne(options);
  }

  public async findMany(options: FindManyOptions<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo[]> {
    return await this.headerArquivoRepository.find(options);
  }
}
