import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { logWarn } from 'src/utils/log-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import {
  DataSource,
  DeepPartial,
  FindManyOptions,
  In,
  InsertResult,
  Repository,
} from 'typeorm';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';

@Injectable()
export class HeaderLoteRepository {
  
  private logger: Logger = new Logger('HeaderLoteRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderLote)
    private headerLoteRepository: Repository<HeaderLote>,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<HeaderLote>[],
  ): Promise<HeaderLote[]> {
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
      DeepPartial<HeaderLote>
    > = existing.reduce(
      (m, i) => ({ ...m, [HeaderLote.getUniqueId(i)]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderLote já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} HeaderLote já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce(
      (l, i) => [...l, ...(!existingMap[HeaderLote.getUniqueId(i)] ? [i] : [])],
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

  public async insert(dtos: DeepPartial<HeaderLote>[]): Promise<InsertResult> {
    return await this.headerLoteRepository.insert(dtos);
  }

  public async saveIfNotExists(
    dto: DeepPartial<HeaderLote>,
    updateIfExists?: boolean,
  ): Promise<SaveIfNotExists<HeaderLote>> {
    const existing = await this.findOne({
      headerArquivo: { id: asNumber(dto.headerArquivo?.id) },
      loteServico: asNumber(dto.loteServico),
    });
    const item =
      !existing || (existing && updateIfExists)
        ? await this.headerLoteRepository.save(dto)
        : existing;
    return {
      isNewItem: !Boolean(existing),
      item: item,
    };
  }

  public async save(dto: DeepPartial<HeaderLote>): Promise<HeaderLote> {
    return await this.headerLoteRepository.save(dto);
  }

  public async getOne(
    fields: EntityCondition<HeaderLote>,
  ): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOneOrFail({
      where: fields,
    });
  }

  public async findOne(
    fields: EntityCondition<HeaderLote>,
  ): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    options?: FindManyOptions<HeaderLote>,
  ): Promise<HeaderLote[]> {
    return await this.headerLoteRepository.find(options);
  }

  public async findAll(headerArquivoId: number) {
    const query = 'SELECT hl.* FROM header_lote hl WHERE hl."headerArquivoId" = $1';

    const queryRunner = this.dataSource.createQueryRunner();   

    try {    
      await queryRunner.connect();    
      const result: any = await queryRunner.manager.query(query, [headerArquivoId]);      
      return result.map((r: DeepPartial<HeaderLote>) => new HeaderLote(r));
    } finally {
        await queryRunner.release();
    }
}



  public async findByFormaLancamento(headerArquivoId: number, formaLancamento:string) {
    const query = (`select hl.* from header_lote hl where hl."headerArquivoId"=${headerArquivoId} 
      and hl."formaLancamento"='${formaLancamento}'`)
    
    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();
     
    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result.map((r: DeepPartial<HeaderLote> | undefined) => new HeaderLote(r)); 
  }
}
