import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { ExtratoDetalheE } from 'src/domain/entity/extrato-detalhe-e.entity';
import { CustomLogger } from 'src/utils/custom-logger';
import { asNumber } from 'src/utils/pipe-utils';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindManyOptions, FindOneOptions, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class ExtratoDetalheERepository {
  private logger = new CustomLogger('ExtratoDetalheERepository', { timestamp: true });

  constructor(
    @InjectRepository(ExtratoDetalheE)
    private extDetalheERepository: Repository<ExtratoDetalheE>,
  ) {}

  public async saveIfNotExists(obj: DeepPartial<ExtratoDetalheE>, updateIfExists?: boolean): Promise<SaveIfNotExists<ExtratoDetalheE>> {
    const existing = obj?.id
      ? await this.extDetalheERepository.findOne({ where: { id: obj.id } })
      : await this.extDetalheERepository.findOne({
          where: {
            extratoHeaderLote: { id: asNumber(obj.extratoHeaderLote?.id) },
            nsr: asNumber(obj.nsr),
          },
        });
    const item = !existing || (existing && updateIfExists) ? await this.extDetalheERepository.save(obj) : existing;
    return {
      isNewItem: !Boolean(existing),
      item: item,
    };
  }

  public async save(obj: DeepPartial<ExtratoDetalheE>): Promise<ExtratoDetalheE> {
    return await this.extDetalheERepository.save(obj);
  }

  public async findOne(options: FindOneOptions<ExtratoDetalheE>): Promise<Nullable<ExtratoDetalheE>> {
    const one = await this.extDetalheERepository.findOne(options);
    return one;
  }

  public async findMany(options: FindManyOptions<ExtratoDetalheE>): Promise<ExtratoDetalheE[]> {
    const many = await this.extDetalheERepository.find(options);
    return many;
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o ExtratoDetalheE.
   *
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return (
      (await this.extDetalheERepository.count({
        where: [{ createdAt: MoreThanOrEqual(startOfDay(date)) }, { createdAt: LessThanOrEqual(endOfDay(date)) }],
      })) + 1
    );
  }
}
