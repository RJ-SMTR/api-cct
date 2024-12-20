import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, FindOneOptions, InsertResult, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { compactQuery } from 'src/utils/console-utils';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';

export interface IDetalheARawWhere {
  id?: number[];
  nsr?: number[];
  itemTransacaoAgrupado?: { id: number[] };
  numeroDocumentoEmpresa?: number;
  headerLote?: { id: number[] };
  nome?: string[];
  dataVencimento?: Date[];
  valorLancamento?: number[];
}

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', { timestamp: true });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
  ) {}

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
    const qWhere: { query: string; params: any[] } = { query: 'WHERE 1=1', params: [] };

    if (where.id) {
      qWhere.query += ` AND da.id IN (${where.id.join(',')})`;
    }

    if (where.numeroDocumentoEmpresa) {
      qWhere.query += ` AND da."numeroDocumentoEmpresa" = $${qWhere.params.length + 1}`;
      qWhere.params.push(where.numeroDocumentoEmpresa);
    }

    if (where.headerLote) {
      qWhere.query += ` AND hl.id IN (${where.headerLote.id.join(',')})`;
    }
     if (where.nsr && where.itemTransacaoAgrupado) {
      qWhere.query += ` AND da.nsr IN (${where.nsr.join(',')}) AND da."itemTransacaoAgrupadoId" IN (${where.itemTransacaoAgrupado.id.join(',')})`;
    }

    if (where.dataVencimento) {
      const normalizedDates = where.dataVencimento.map((date) => {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          throw new Error(`Invalid date format: ${date}`);
        }
        return parsedDate.toISOString();
      });
      qWhere.query += ` AND da."dataVencimento" = ANY(ARRAY[${normalizedDates
        .map((date) => `'${date}'`)
        .join(',')}]::timestamp[])`;
    }

    if (where.valorLancamento) {
      qWhere.query += ` AND da."valorLancamento" IN (${where.valorLancamento
        .map((valor) => `${valor}`)
        .join(',')})`;
    }

    if (where.nome) {
      const trimmedNames = where.nome.map((n) => n.trim());
      const nomes = trimmedNames.map((n) => `'%${n}%'`);
      qWhere.query += ` AND cf.nome ILIKE ANY(ARRAY[${nomes.join(',')}])`;

      const containsCorsorcio = trimmedNames.some(
        (name) => name.toLowerCase().includes('concessionaria') || name.toLowerCase().includes('consorcio')
      );
      if (containsCorsorcio && where.numeroDocumentoEmpresa) {
        qWhere.query += ` AND da."numeroDocumentoEmpresa" = $${qWhere.params.length + 1}`;
        qWhere.params.push(where.numeroDocumentoEmpresa);
      }
    }

    const result: any[] = await this.detalheARepository.query(
      compactQuery(`
      SELECT
          da.id, da."createdAt", da."dataEfetivacao", da."dataVencimento", da."finalidadeDOC",
          da."indicadorBloqueio", da."indicadorFormaParcelamento", da."loteServico", da.nsr,
          da."numeroDocumentoBanco", da."numeroDocumentoEmpresa", da."numeroParcela",
          da."ocorrenciasCnab", da."periodoVencimento", da."quantidadeMoeda"::FLOAT,
          da."quantidadeParcelas", da."tipoMoeda", da."updatedAt", da."valorLancamento"::FLOAT,
          da."valorRealEfetivado"::FLOAT,
          JSON_BUILD_OBJECT(
              'id', da."itemTransacaoAgrupadoId",
              'dataOrdem', ta."dataOrdem",
              'transacaoAgrupado', JSON_BUILD_OBJECT(
                  'id', ta.id,
                  'status', JSON_BUILD_OBJECT('id', ts.id, 'name', ts.name)
              )
          ) AS "itemTransacaoAgrupado",
          JSON_BUILD_OBJECT(
              'id', hl.id,
              'headerArquivo', JSON_BUILD_OBJECT('id', ha.id, 'dataGeracao', ha."dataGeracao")
          ) AS "headerLote"
      FROM detalhe_a da
      INNER JOIN header_lote hl ON da."headerLoteId" = hl.id
      INNER JOIN header_arquivo ha ON hl."headerArquivoId" = ha.id
      INNER JOIN item_transacao_agrupado ita ON da."itemTransacaoAgrupadoId" = ita.id
      INNER JOIN transacao_agrupado ta ON ta.id = ita."transacaoAgrupadoId"
      INNER JOIN transacao_status ts ON ts.id = ta."statusId"
      INNER JOIN item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
      INNER JOIN cliente_favorecido cf on it."clienteFavorecidoId" = cf.id
      ${qWhere.query}
      ORDER BY da.id
    `),
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
    const count = await this.detalheARepository
      .createQueryBuilder('detalheA')
      .where([{ createdAt: MoreThanOrEqual(startOfDay(date)) }, { createdAt: LessThanOrEqual(endOfDay(date)) }])
      .getCount();
    return count + 1;
  }
}
