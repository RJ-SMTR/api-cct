import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { logWarn } from 'src/utils/log-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import {
  DataSource,
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  In,
  Repository,
} from 'typeorm';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';

@Injectable()
export class HeaderArquivoRepository {
  [x: string]: any;
  private logger: Logger = new Logger('HeaderArquivoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderArquivo)
    private headerArquivoRepository: Repository<HeaderArquivo>,
    private readonly dataSource: DataSource,
  ) {}

  public async save(dto: DeepPartial<HeaderArquivo>): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.save(dto);
  }

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(
    dtos: HeaderArquivoDTO[],
  ): Promise<HeaderArquivo[]> {
    // Existing
    const existing = await this.headerArquivoRepository.find({
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
        `${existing.length}/${dtos.length} HeaderArquivos já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderArquivos já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce(
      (l, i) => [
        ...l,
        ...(!existingMap[HeaderArquivo.getUniqueId(i)] ? [i] : []),
      ],
      [],
    );
    const insert = await this.headerArquivoRepository.insert(newDTOs);
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
  ): Promise<SaveIfNotExists<HeaderArquivo>> {
    const existing = await this.headerArquivoRepository.findOne({
      where: {
        nsa: dto.nsa,
        tipoArquivo: dto.tipoArquivo,
      },
    });
    const item = existing || (await this.headerArquivoRepository.save(dto));
    return {
      isNewItem: !Boolean(existing),
      item: item,
    };
  }

  public async getOne(
    fields: EntityCondition<HeaderArquivo>,
    order?: FindOptionsOrder<HeaderArquivo>,
  ): Promise<HeaderArquivo> {
    const headers = await this.headerArquivoRepository.find({
      where: fields,
      order: order,
    });
    const header = headers.pop() || null;
    if (!header) {
      const fieldsList = Object.entries(fields).map((i) => `(${i})`);
      throw CommonHttpException.notFound(
        `HeaderArquivo.${fieldsList.join(',')}`,
      );
    } else {
      return header;
    }
  }

  public async findOne(
    options: FindOneOptions<HeaderArquivo>,
  ): Promise<HeaderArquivo | null> {
    return await this.headerArquivoRepository.findOne(options);
  }

  public async findMany(
    options: FindManyOptions<HeaderArquivo>,
  ): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.find(options);
  }

  public async getHeaderArquivo(status:string,remessaName:string): Promise<HeaderArquivo>{
    const query  = (`select ha.* from header_arquivo ha where ha."status" ='${status}' 
      and ha."remessaName" ='${remessaName}' `);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();   
    let result: any = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r: DeepPartial<HeaderArquivo> | undefined) => new HeaderArquivo(r));
  }
}
