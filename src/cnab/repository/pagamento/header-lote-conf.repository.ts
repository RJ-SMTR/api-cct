import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HeaderLoteConf } from 'src/cnab/entity/conference/header-lote-conf.entity';
import { logWarn } from 'src/utils/log-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import {
  DeepPartial,
  FindManyOptions,
  In,
  InsertResult,
  Repository,
} from 'typeorm';


@Injectable()
export class HeaderLoteConfRepository {
  private logger: Logger = new Logger('HeaderLoteConfRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderLoteConf)
    private HeaderLoteConfRepository: Repository<HeaderLoteConf>,
  ) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<HeaderLoteConf>[],
  ): Promise<HeaderLoteConf[]> {
    const existing = await this.findMany({
      // Existing
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            headerArquivo: { id: asNumber(i.headerArquivo?.id) },
            loteServico: asNumber(i.loteServico),
          },
        ],
        [],
      ),
    });
    const existingMap: Record<
      string,
      DeepPartial<HeaderLoteConf>
    > = existing.reduce(
      (m, i) => ({ ...m, [HeaderLoteConf.getUniqueId(i)]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderLoteConf já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderLoteConf já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce(
      (l, i) => [...l, ...(!existingMap[HeaderLoteConf.getUniqueId(i)] ? [i] : [])],
      [],
    );
    const insert = await this.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    const saved = await this.findMany({ where: { id: In(insertIds) } });
    return saved;
  }

  public async insert(dtos: DeepPartial<HeaderLoteConf>[]): Promise<InsertResult> {
    return await this.HeaderLoteConfRepository.insert(dtos);
  }

  public async saveIfNotExists(
    dto: DeepPartial<HeaderLoteConf>,
    updateIfExists?: boolean,
  ): Promise<SaveIfNotExists<HeaderLoteConf>> {
    const existing = await this.findOne({
      headerArquivo: { id: asNumber(dto.headerArquivo?.id) },
      loteServico: asNumber(dto.loteServico),
    });
    const item =
      !existing || (existing && updateIfExists)
        ? await this.HeaderLoteConfRepository.save(dto)
        : existing;
    return {
      isNewItem: !Boolean(existing),
      item: item,
    };
  }

  public async save(dto: DeepPartial<HeaderLoteConf>): Promise<HeaderLoteConf> {
    return await this.HeaderLoteConfRepository.save(dto);
  }

  public async getOne(
    fields: EntityCondition<HeaderLoteConf>,
  ): Promise<Nullable<HeaderLoteConf>> {
    return await this.HeaderLoteConfRepository.findOneOrFail({
      where: fields,
    });
  }

  public async findOne(
    fields: EntityCondition<HeaderLoteConf>,
  ): Promise<Nullable<HeaderLoteConf>> {
    return await this.HeaderLoteConfRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    options?: FindManyOptions<HeaderLoteConf>,
  ): Promise<HeaderLoteConf[]> {
    return await this.HeaderLoteConfRepository.find(options);
  }
}
