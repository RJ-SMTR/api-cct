import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { logWarn } from 'src/utils/log-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import {
  DeepPartial,
  FindManyOptions,
  InsertResult,
  Repository,
} from 'typeorm';
import { ArquivoPublicacaoDTO } from '../dto/arquivo-publicacao.dto';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';

@Injectable()
export class ArquivoPublicacaoRepository {
  private logger: Logger = new Logger('ArquivoPublicacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ArquivoPublicacao)
    private arquivoPublicacaoRepository: Repository<ArquivoPublicacao>,
  ) {}

  /**
   * Bulk save
   */
  public async insert(
    dtos: DeepPartial<ArquivoPublicacao>[],
  ): Promise<InsertResult> {
    return this.arquivoPublicacaoRepository.insert(dtos);
  }

  public async upsert(
    items: DeepPartial<ArquivoPublicacao>[],
  ): Promise<InsertResult> {
    return await this.arquivoPublicacaoRepository.upsert(items, {
      conflictPaths: { id: true },
    });
  }

  public save(dto: ArquivoPublicacaoDTO): Promise<ArquivoPublicacao> {
    return this.arquivoPublicacaoRepository.save(dto);
  }

  public async update(
    id: number,
    dto: DeepPartial<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao> {
    await this.arquivoPublicacaoRepository.update(id, dto);
    const updated = await this.getOne({ where: { id: id } });
    return updated;
  }

  /**
   * Save if detalheARetornoId not exists yet.
   */
  public async saveIfNotExists(
    dto: ArquivoPublicacaoDTO,
    updateIfExists?: boolean,
  ): Promise<SaveIfNotExists<ArquivoPublicacao>> {
    const METHOD = 'saveIfNotExists()';
    const existing = await this.arquivoPublicacaoRepository.findOne({
      where: { idDetalheARetorno: dto.idDetalheARetorno },
    });
    if (existing) {
      const itemResult = updateIfExists
        ? await this.arquivoPublicacaoRepository.save({
            ...dto,
            id: existing.id,
          })
        : existing;
      logWarn(
        this.logger,
        'detalheARetorno já existe no Arq.Pub. Ignorando...',
        METHOD,
      );
      return {
        isNewItem: false,
        item: itemResult,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.arquivoPublicacaoRepository.save(dto),
      };
    }
  }

  public async getOne(
    options: FindManyOptions<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao> {
    return await this.arquivoPublicacaoRepository.findOneOrFail(options);
  }

  public async findMany(
    options: FindManyOptions<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao[]> {
    return await this.arquivoPublicacaoRepository.find(options);
  }
}
