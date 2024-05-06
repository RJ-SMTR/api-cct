import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtratoHeaderLote } from 'src/cnab/entity/extrato/extrato-header-lote.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asNumber } from 'src/utils/pipe-utils';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindManyOptions, FindOneOptions, Repository } from 'typeorm';

@Injectable()
export class ExtratoHeaderLoteRepository {
  private logger: Logger = new Logger('ExtratoHeaderLoteRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ExtratoHeaderLote)
    private extHeaderLoteRepository: Repository<ExtratoHeaderLote>,
  ) { }


  public async saveIfNotExists(dto: DeepPartial<ExtratoHeaderLote>, updateIfExists?: boolean
  ): Promise<SaveIfNotExists<ExtratoHeaderLote>> {
    const existing = await this.findOne({
      where: {
        extratoHeaderArquivo: { id: asNumber(dto.extratoHeaderArquivo?.id) },
        loteServico: dto.loteServico,
      }
    });
    if (existing) {
      const item = updateIfExists
        ? await this.save({ id: existing.id, ...dto })
        : existing;
      return {
        isNewItem: false,
        item: item,
      }
    } else {
      return {
        isNewItem: true,
        item: await this.save(dto),
      }
    }
  }

  public async save(obj: DeepPartial<ExtratoHeaderLote>): Promise<ExtratoHeaderLote> {
    return await this.extHeaderLoteRepository.save(obj);
  }

  public async findOne(options: FindOneOptions<ExtratoHeaderLote>): Promise<Nullable<ExtratoHeaderLote>> {
    return await this.extHeaderLoteRepository.findOne(options);
  }

  public async getOne(options: FindOneOptions<ExtratoHeaderLote>): Promise<ExtratoHeaderLote> {
    try {
      const header = await this.extHeaderLoteRepository.findOneOrFail(options);
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
    return await this.extHeaderLoteRepository.find(options);
  }
}
