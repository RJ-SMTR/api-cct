import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  FindManyOptions,
  InsertResult,
  Repository,
} from 'typeorm';
import { ArquivoPublicacaoReturnDTO } from '../dto/arquivo-publicacao-return.dto';
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

  public save(dto: DeepPartial<ArquivoPublicacao>): Promise<ArquivoPublicacao> {
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

  async findManyByDate(startDate: Date, endDate: Date) {
    const result: any[] = await this.arquivoPublicacaoRepository.query(
      `
        SELECT
          ap.*,
          it.*,
          cf.nome as favorecido,
          da.id as "detalheAId",
          o.message as "ocorrenciaMessage"
        FROM arquivo_publicacao ap
        LEFT JOIN item_transacao it on ap."itemTransacaoId" = it.id
        LEFT JOIN cliente_favorecido cf on cf.id = it."clienteFavorecidoId"
        LEFT JOIN detalhe_a da on da."itemTransacaoAgrupadoId" = it.id
        LEFT JOIN ocorrencia o on o."detalheAId" = da.id
        WHERE it."dataOrdem" BETWEEN $1 AND $2
        ORDER BY
          ap.id, it.id, da.id
      `,
      [startDate, endDate],
    );
    const publicacaoDTOs: ArquivoPublicacaoReturnDTO[] = [];
    for (const item of result) {
      if (!publicacaoDTOs.map((i) => i.id).includes(item.id)) {
        const ocorrencias = result
          .filter((r) => r.id === item.id && r.ocorrenciaMessage)
          .map((r) => r.ocorrenciaMessage);
        const publicacao = new ArquivoPublicacaoReturnDTO({
          ...item,
          ocorrencias,
        }) as any;
        delete publicacao.clienteFavorecidoId;
        delete publicacao.transacaoId;
        delete publicacao.nomeOperadora;
        publicacaoDTOs.push(publicacao);
      }
    }
    return publicacaoDTOs;
  }

  /**
   * Save if detalheARetornoId not exists yet.
   */
  // public async saveIfNotExists(
  //   dto: ArquivoPublicacaoDTO,
  //   updateIfExists?: boolean,
  // ): Promise<SaveIfNotExists<ArquivoPublicacao>> {
  //   const METHOD = 'saveIfNotExists()';
  //   const existing = await this.arquivoPublicacaoRepository.findOne({
  //     where: { idDetalheARetorno: dto.idDetalheARetorno },
  //   });
  //   if (existing) {
  //     const itemResult = updateIfExists
  //       ? await this.arquivoPublicacaoRepository.save({
  //           ...dto,
  //           id: existing.id,
  //         })
  //       : existing;
  //     logWarn(
  //       this.logger,
  //       'detalheARetorno já existe no Arq.Pub. Ignorando...',
  //       METHOD,
  //     );
  //     return {
  //       isNewItem: false,
  //       item: itemResult,
  //     };
  //   } else {
  //     return {
  //       isNewItem: true,
  //       item: await this.arquivoPublicacaoRepository.save(dto),
  //     };
  //   }
  // }

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

  public async findOne(
    options: FindManyOptions<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao | null> {
    const many = await this.arquivoPublicacaoRepository.find(options);
    return many.pop() || null;
  }
}
