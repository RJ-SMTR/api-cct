import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DeepPartial,
  FindManyOptions,
  In,
  InsertResult,
  QueryRunner,
  Repository,
} from 'typeorm';
import { ArquivoPublicacaoResultDTO } from '../dto/arquivo-publicacao-result.dto';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheAService } from '../service/pagamento/detalhe-a.service';
import { OcorrenciaService } from '../service/ocorrencia.service';
import { ItemTransacaoAgrupadoService } from '../service/pagamento/item-transacao-agrupado.service';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';

@Injectable()
export class ArquivoPublicacaoRepository {
  private logger: Logger = new Logger('ArquivoPublicacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ArquivoPublicacao)
    private arquivoPublicacaoRepository: Repository<ArquivoPublicacao>,
    private detalheAService: DetalheAService,
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

  public async update(
    id: number,
    dto: DeepPartial<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao> {
    await this.arquivoPublicacaoRepository.update(id, dto);
    const updated = await this.getOne({ where: { id: id } });
    return updated;
  }

  async findManyByDate(startDate: Date, endDate: Date) {
    const publicacoes = await this.findMany({
      where: {
        dataVencimento: Between(startDate, endDate),
      },
    });
    const detalheAList = await this.detalheAService.findMany({
      itemTransacaoAgrupado: {
        id: In(
          publicacoes.map((i) => i.itemTransacao.itemTransacaoAgrupado.id),
        ),
      },
    });

    const publicacaoResults: ArquivoPublicacaoResultDTO[] = [];
    for (const publicacao of publicacoes) {
      /** DetalheA é undefined se rodamos `saveNewTransacoesJae()` mas ainda não rodamos `sendRemessa()` */
      const detalheA = detalheAList.filter(
        (i) =>
          i.itemTransacaoAgrupado.id &&
          i.itemTransacaoAgrupado.id ===
            publicacao.itemTransacao.itemTransacaoAgrupado.id,
      )[0] as DetalheA | undefined;
      publicacaoResults.push(
        new ArquivoPublicacaoResultDTO(publicacao, detalheA?.ocorrencias),
      );
    }
    return publicacaoResults;
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

  public async findOne(
    options: FindManyOptions<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao | null> {
    const many = await this.arquivoPublicacaoRepository.find(options);
    return many.pop() || null;
  }
}
