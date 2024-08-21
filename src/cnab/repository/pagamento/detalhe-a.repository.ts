import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { logWarn } from 'src/utils/log-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, FindOneOptions, In, InsertResult, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { getDateYMDString } from 'src/utils/date-utils';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';

export interface IDetalheARawWhere {
  id?: number[];
  detalheARem?: {
    dataVencimento: Date;
    numeroDocumentoEmpresa: number;
    valorLancamento: number;
  };
}

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', { timestamp: true });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
  ) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(dtos: DeepPartial<DetalheA>[]): Promise<DetalheA[]> {
    // Existing
    const existing = await this.findMany({
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            headerLote: { id: asNumber(i.headerLote?.id) },
            nsr: asNumber(i.nsr),
          },
        ],
        [],
      ),
    });
    const existingMap: Record<string, DeepPartial<DetalheA>> = existing.reduce((m, i) => ({ ...m, [DetalheA.getUniqueId(i)]: i }), {});
    // Check
    if (existing.length === dtos.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} DetalhesA já existem, nada a fazer...`);
    } else if (existing.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} DetalhesA já existem, ignorando...`);
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce((l, i) => [...l, ...(!existingMap[DetalheA.getUniqueId(i)] ? [i] : [])], []);
    const insert = await this.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    const saved = await this.findMany({ where: { id: In(insertIds) } });
    return saved;
  }

  public insert(dtos: DeepPartial<DetalheA>[]): Promise<InsertResult> {
    return this.detalheARepository.insert(dtos);
  }

  public async save(dto: DeepPartial<DetalheA>): Promise<DetalheA> {
    const saved = await this.detalheARepository.save(dto);
    return await this.getOneRaw({ id: [saved.id] });
  }

  public async getOne(fields: EntityCondition<DetalheA>): Promise<DetalheA> {
    return await this.detalheARepository.findOneOrFail({
      where: fields,
    });
  }

  public async findRaw(where: IDetalheARawWhere): Promise<DetalheA[]> {
    const qWhere: { query: string; params?: any[] } = { query: '' };
    if (where.id) {
      qWhere.query = `WHERE da.id IN (${where.id.join(',')})`;
      qWhere.params = [];
    } else if (where.detalheARem) {
      const { dataVencimento, numeroDocumentoEmpresa, valorLancamento } = where.detalheARem;
      qWhere.query = `WHERE da."dataVencimento"::DATE = $1 AND da."numeroDocumentoEmpresa" = $2 AND da."valorLancamento" = $3`;
      qWhere.params = [getDateYMDString(dataVencimento), numeroDocumentoEmpresa, valorLancamento];
    }
    const result: any[] = await this.detalheARepository.query(
      `
      SELECT
          da.id, da."createdAt", da."dataEfetivacao", da."dataVencimento", da."finalidadeDOC",
          da."indicadorBloqueio", da."indicadorFormaParcelamento", da."loteServico", da.nsr,
          da."numeroDocumentoBanco", da."numeroDocumentoEmpresa", da."numeroParcela",
          da."ocorrenciasCnab", da."periodoVencimento", da."quantidadeMoeda",
          da."quantidadeParcelas", da."tipoMoeda", da."updatedAt", da."valorLancamento",
          da."valorRealEfetivado",
          json_build_object(
              'id', da."itemTransacaoAgrupadoId",
              'transacaoAgrupado', json_build_object(
                  'id', ta.id,
                  'status', json_build_object('id', ts.id, 'name', ts.name)
              )
          ) AS "itemTransacaoAgrupado",
          json_build_object(
              'id', hl.id,
              'headerArquivo', json_build_object('id', ha.id, 'dataGeracao', ha."dataGeracao")
          ) AS "headerLote"
      FROM detalhe_a da
      INNER JOIN header_lote hl ON da."headerLoteId" = hl.id
      INNER JOIN header_arquivo ha ON hl."headerArquivoId" = ha.id
      INNER JOIN item_transacao_agrupado ita ON da."itemTransacaoAgrupadoId" = ita.id
      INNER JOIN transacao_agrupado ta ON ta.id = ita."transacaoAgrupadoId"
      INNER JOIN transacao_status ts ON ts.id = ta."statusId"
      ${qWhere.query}
      ORDER BY da.id
    `,
      qWhere.params,
    );
    const detalhes = result.map((i) => new DetalheA(i));
    return detalhes;
  }

  public async findOneRaw(where: IDetalheARawWhere): Promise<DetalheA | null> {
    const result = await this.findRaw(where);
    if (result.length == 0) {
      return null;
    } else {
      return result[0];
    }
  }

  public async getOneRaw(where: IDetalheARawWhere): Promise<DetalheA> {
    const result = await this.findRaw(where);
    if (result.length == 0) {
        throw CommonHttpException.details('It should return at least one DetalheA');
    } else {
      return result[0];
    }
  }

  public async findOne(options: FindOneOptions<DetalheA>): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(options);
  }

  public async findMany(options?: FindManyOptions<DetalheA>): Promise<DetalheA[]> {
    const detalheA = await this.detalheARepository.find(options);
    // await this.forceManyEager(detalheA);
    return detalheA;
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o DetalheA.
   *
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return (
      (await this.detalheARepository.count({
        where: [{ createdAt: MoreThanOrEqual(startOfDay(date)) }, { createdAt: LessThanOrEqual(endOfDay(date)) }],
      })) + 1
    );
  }

  /**
   * For some reason the default eager of ClienteFavorecido doesnt get columns like cpfCnpj.
   *
   * So we query separately the Entity and use it.
   */
  // private async forceManyEager(detalhesA: DetalheA[]) {
  //   const favorecidoIds = detalhesA.reduce(
  //     (l, i) => [...l, i.clienteFavorecido.id],
  //     [],
  //   );
  //   if (favorecidoIds.length === 0) {
  //     return;
  //   }
  //   const favorecidos: ClienteFavorecido[] =
  //     await this.detalheARepository.query(
  //       `SELECT * from cliente_favorecido c WHERE c.id IN (${favorecidoIds.join(
  //         ',',
  //       )})`,
  //     );
  //   const favorecidosMap: Record<number, ClienteFavorecido> =
  //     favorecidos.reduce((m, i) => ({ ...m, [i.id]: i }), {});
  //   for (const one of detalhesA) {
  //     one.clienteFavorecido = favorecidosMap[one.clienteFavorecido.id];
  //   }
  // }
}
