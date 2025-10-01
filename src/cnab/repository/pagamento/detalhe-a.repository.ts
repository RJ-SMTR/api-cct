import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, FindManyOptions, FindOneOptions, InsertResult, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { compactQuery } from 'src/utils/console-utils';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { formatDateISODate } from 'src/utils/date-utils';

export interface IDetalheARawWhere {
  id?: number[];
  nsr?: number[];
  itemTransacaoAgrupado?: { id: number[] };
  numeroDocumentoEmpresa?: number;
  headerLote?: { id: number[] };
}

@Injectable()
export class DetalheARepository {

  private logger: Logger = new Logger('DetalheARepository', { timestamp: true });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
    private readonly dataSource: DataSource
  ) { }

  public insert(dtos: DeepPartial<DetalheA>[]): Promise<InsertResult> {
    return this.detalheARepository.insert(dtos);
  }

  public async save(dto: DeepPartial<DetalheA>): Promise<DetalheA> {
    return await this.detalheARepository.save(dto);
    // return await this.getOneRaw({ id: [saved.id] });
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
    } else if (where.numeroDocumentoEmpresa) {
      qWhere.query = `WHERE da."numeroDocumentoEmpresa" = $1`;
      qWhere.params = [where.numeroDocumentoEmpresa];
    } else if (where.headerLote) {
      qWhere.query = `WHERE hl.id IN(${where.headerLote.id.join(',')})`;
    } else if (where.nsr && where.itemTransacaoAgrupado) {
      qWhere.query = `WHERE da.nsr IN(${where.nsr.join(',')}) AND da."itemTransacaoAgrupadoId" IN(${where.itemTransacaoAgrupado.id.join(',')})`;
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
      ${qWhere.query}
      ORDER BY da.id
    `),
      qWhere.params,
    );
    const detalhes = result.map((i) => new DetalheA(i));
    return detalhes;
  }

  async existsDetalheA(id: number) {
    const query = (`select da.* from detalhe_a da  
                                inner join ordem_pagamento_agrupado_historico oph 
                                on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
                                where da."ordemPagamentoAgrupadoHistoricoId"=${id} `)

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    const result: any[] = await queryRunner.query(query);

    const detalhes = result.map((i) => new DetalheA(i));

    queryRunner.release()

    return detalhes;

  }

  async getDetalheAHeaderLote(id: number) {

    const query = (`select da.* from detalhe_a da where da."headerLoteId" = ${id} 
      order by da."nsr" asc `)

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const result: any[] = await queryRunner.manager.getRepository(DetalheA).query(query);

      if (queryRunner.isTransactionActive) {
        await queryRunner.commitTransaction();
      }

      return result.map((i) => new DetalheA(i));

    } finally {
      await queryRunner.release()
    }
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


  async getDetalheARetorno(dataVencimento: Date, valorLancamento: number,
    userBankCode: string, userBankAccount: string) {
    const dataIso = formatDateISODate(dataVencimento);
    const query = (`select da.* from detalhe_a da  
                                inner join ordem_pagamento_agrupado_historico oph 
                                on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
                                where da."dataVencimento"='${dataIso}' and 
                                da."valorLancamento" =${valorLancamento} and 
                                oph."userBankCode"='${userBankCode}' and                              
                                oph."userBankAccount" ilike '%${userBankAccount}%' and
                                oph."statusRemessa" in(1,2)`)

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    const result: any[] = await queryRunner.query(query);

    const detalhes = result.map((i) => new DetalheA(i));

    queryRunner.release()

    return detalhes;

  }


  async getOrdemPagamento(detalheAId: number) {
    const sql = `
    SELECT DISTINCT 
      opa."dataPagamento",
      opa."valorTotal",
      opa."id" as "ordemPagamentoAgrupadoId"
    FROM detalhe_a da
    INNER JOIN ordem_pagamento_agrupado_historico oph 
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN ordem_pagamento_agrupado opa 
      ON opa.id = oph."ordemPagamentoAgrupadoId"
    INNER JOIN ordem_pagamento op 
      ON op."ordemPagamentoAgrupadoId" = opa.id
    WHERE da.id = $1
  `;

    const result = await this.dataSource.query(sql, [detalheAId]);

    if (!result || result.length === 0) return null;

    return result[0];
  }

}
