import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asNumber } from 'src/utils/pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindManyOptions, FindOneOptions, Repository } from 'typeorm';

@Injectable()
export class ExtratoHeaderArquivoRepository {
  [x: string]: any;
  private logger: Logger = new Logger('ExtratoHeaderArquivoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ExtratoHeaderArquivo)
    private extHeaderArquivoRepository: Repository<ExtratoHeaderArquivo>,
  ) { }

  public async saveIfNotExists(dto: DeepPartial<ExtratoHeaderArquivo>, updateIfExists?: boolean
  ): Promise<SaveIfNotExists<ExtratoHeaderArquivo>> {
    const existing = dto?.id
      ? await this.extHeaderArquivoRepository.findOne({ where: { id: dto.id } })
      : await this.extHeaderArquivoRepository.findOne({
        where: {
          nsa: asNumber(dto.nsa),
          tipoArquivo: asNumber(dto.tipoArquivo),
        }
      });
    const item = !existing || (existing && updateIfExists)
      ? await this.extHeaderArquivoRepository.save(dto)
      : existing;
    return {
      isNewItem: !Boolean(existing),
      item: item,
    }
  }

  /**
   * If has existing id, update, otherwise save.
   */
  public async save(obj: DeepPartial<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    return await this.extHeaderArquivoRepository.save(obj);
  }

  public async getOne(options: FindOneOptions<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    try {
      const header = await this.extHeaderArquivoRepository.findOneOrFail(options);
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
    return await this.extHeaderArquivoRepository.findOne(options);
  }

  public async findMany(options: FindManyOptions<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo[]> {
    return await this.extHeaderArquivoRepository.find(options);
  }
}
