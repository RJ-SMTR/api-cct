import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HeaderArquivoDTO } from 'src/cnab/dto/pagamento/header-arquivo.dto';
import { HeaderArquivoConf } from 'src/cnab/entity/conference/header-arquivo-conf.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { logWarn } from 'src/utils/log-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  In,
  Repository,
} from 'typeorm';


@Injectable()
export class HeaderArquivoConfRepository {
  [x: string]: any;
  private logger: Logger = new Logger('HeaderArquivoConfRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderArquivoConf)
    private HeaderArquivoConfRepository: Repository<HeaderArquivoConf>,
  ) {}

  public async save(dto: DeepPartial<HeaderArquivoConf>): Promise<HeaderArquivoConf> {
    return await this.HeaderArquivoConfRepository.save(dto);
  }

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(
    dtos: HeaderArquivoDTO[],
  ): Promise<HeaderArquivoConf[]> {
    // Existing
    const existing = await this.HeaderArquivoConfRepository.find({
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            nsa: i.nsa,
            tipoArquivo: i.tipoArquivo,
          },
        ],
        [],
      ),
    });
    const existingMap: Record<string, HeaderArquivoDTO> = existing.reduce(
      (m, i) => ({ ...m, [`${i.nsa}|${i.tipoArquivo}`]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderArquivoConfs já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderArquivoConfs já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce(
      (l, i) => [
        ...l,
        ...(!existingMap[HeaderArquivoConf.getUniqueId(i)] ? [i] : []),
      ],
      [],
    );
    const insert = await this.HeaderArquivoConfRepository.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    const saved = await this.findMany({ where: { id: In(insertIds) } });
    return saved;
  }

  public async saveIfNotExists(
    dto: HeaderArquivoDTO,
  ): Promise<SaveIfNotExists<HeaderArquivoConf>> {
    const existing = await this.HeaderArquivoConfRepository.findOne({
      where: {
        nsa: dto.nsa,
        tipoArquivo: dto.tipoArquivo,
      },
    });
    const item = existing || (await this.HeaderArquivoConfRepository.save(dto));
    return {
      isNewItem: !Boolean(existing),
      item: item,
    };
  }

  public async getOne(
    fields: EntityCondition<HeaderArquivoConf>,
    order?: FindOptionsOrder<HeaderArquivoConf>,
  ): Promise<HeaderArquivoConf> {
    const headers = await this.HeaderArquivoConfRepository.find({
      where: fields,
      order: order,
    });
    const header = headers.pop() || null;
    if (!header) {
      const fieldsList = Object.entries(fields).map((i) => `(${i})`);
      throw CommonHttpException.notFound(
        `HeaderArquivoConf.${fieldsList.join(',')}`,
      );
    } else {
      return header;
    }
  }

  public async findOne(
    options: FindOneOptions<HeaderArquivoConf>,
  ): Promise<HeaderArquivoConf | null> {
    return await this.HeaderArquivoConfRepository.findOne(options);
  }

  public async findMany(
    options: FindManyOptions<HeaderArquivoConf>,
  ): Promise<HeaderArquivoConf[]> {
    return await this.HeaderArquivoConfRepository.find(options);
  }
}
