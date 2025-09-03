import { Injectable } from '@nestjs/common';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingsService } from 'src/settings/settings.service';
import { TRIntegrationTypeMap } from 'src/ticket-revenues/maps/ticket-revenues.map';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { CustomLogger } from 'src/utils/custom-logger';
import { logWarn } from 'src/utils/log-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { BigqueryService, BigquerySource } from '../bigquery.service';
import { BigqueryTransacao } from '../entities/transacao.bigquery-entity';
import { BqTsansacaoTipoIntegracaoMap } from '../maps/bq-transacao-tipo-integracao.map';
import { BqTransacaoTipoPagamentoMap } from '../maps/bq-transacao-tipo-pagamento.map';

export interface IBqFindTransacao {
  cpfCnpj?: string;
  manyCpfCnpj?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
  valor_pagamento?: number[] | null | ['>=' | '<=' | '>' | '<', number] | 'NOT NULL';
  id_transacao?: string[] | null;
  id_operadora?: string[];
  nomeConsorcio?: { in?: string[]; notIn?: string[] };
}

@Injectable()
export class BigqueryTransacaoRepository {
  private logger = new CustomLogger('BigqueryTransacaoRepository', {
    timestamp: true,
  });

  constructor(private readonly bigqueryService: BigqueryService, private readonly settingsService: SettingsService) {}

  public async countAll() {
    const result = await this.bigqueryService.query(BigquerySource.smtr, 'SELECT COUNT(*) as length FROM `rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao`');
    const len = result[0].length;
    return len;
  }

  public async findMany(filter?: IBqFindTransacao): Promise<BigqueryTransacao[]> {
    const transacoes: BigqueryTransacao[] = (await this.queryData(filter)).data;
    return transacoes;
  }

  public async findManyByOrdemPagamentoIdIn(ordemPagamentoIds: number[], cpfCnpj: string | undefined, isAdmin: boolean): Promise<BigqueryTransacao[]> {
    let query = `SELECT DISTINCT CAST(t.datetime_transacao AS STRING)     datetime_transacao,
                        CAST(t.datetime_processamento AS STRING) datetime_processamento,
                        t.valor_pagamento             valor_pagamento,
                        t.valor_transacao             valor_transacao,
                        t.tipo_pagamento,
                        CASE t.tipo_transacao_smtr
                                when 'Débito EMV' then 'Integral'
                                else t.tipo_transacao_smtr
                        end tipo_transacao_smtr,
                        t.tipo_transacao
                 FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t
                     LEFT JOIN \`rj-smtr.cadastro.operadoras\` o
                 ON o.id_operadora = t.id_operadora
                     LEFT JOIN \`rj-smtr.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio
                 WHERE 1 = 1
                   AND t.valor_pagamento
                     > 0
                   AND t.id_ordem_pagamento_consorcio_operador_dia IN UNNEST(?)`;

    function mapBigQueryTransacao(item: any) {
      const bigqueryTransacao = new BigqueryTransacao();
      bigqueryTransacao.datetime_transacao = item.datetime_transacao;
      bigqueryTransacao.datetime_processamento = item.datetime_processamento;
      bigqueryTransacao.valor_pagamento = item.valor_pagamento;
      bigqueryTransacao.valor_transacao = item.valor_transacao;
      bigqueryTransacao.tipo_pagamento = item.tipo_pagamento;
      bigqueryTransacao.tipo_transacao = item.tipo_transacao;
      bigqueryTransacao.tipo_transacao_smtr = item.tipo_transacao_smtr;
      return bigqueryTransacao;
    }

    if (!isAdmin) {
      query += ` AND CAST(o.documento AS STRING) = ?`;
      const queryResult = await this.bigqueryService.query(BigquerySource.smtr, query, [ordemPagamentoIds, cpfCnpj]);
      return queryResult.map((item: any) => {
        return mapBigQueryTransacao(item);
      });
    } else {
      const queryResult = await this.bigqueryService.query(BigquerySource.smtr, query, [ordemPagamentoIds]);
      return queryResult.map((item: any) => {
        return mapBigQueryTransacao(item);
      });
    }
  }

  public async findManyByOrdemPagamentoIdInGroupedByTipoTransacao(ordemPagamentoId: (number | undefined)[], cpfCnpj: string | undefined, isAdmin: boolean): Promise<BigqueryTransacao[]> {
    let query = `SELECT ROUND(t.valor_pagamento, 2) valor_pagamento,
                        ROUND(t.valor_transacao, 2) valor_transacao,
                        t.tipo_pagamento,
                        t.tipo_transacao
                 FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t
                     LEFT JOIN \`rj-smtr.cadastro.operadoras\` o
                 ON o.id_operadora = t.id_operadora
                     LEFT JOIN \`rj-smtr.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio
                 WHERE 1 = 1
                   AND t.valor_pagamento
                     > 0
                   AND t.id_ordem_pagamento_consorcio_operador_dia IN UNNEST(?)`;

    const ordensPagamentoIdStr = ordemPagamentoId.map((id) => id?.toString());

    function mapBigQueryTransacaoAgrupado(item: any) {
      const bigqueryTransacao = new BigqueryTransacao();
      bigqueryTransacao.valor_pagamento = item.valor_pagamento;
      bigqueryTransacao.valor_transacao = item.valor_transacao;
      bigqueryTransacao.tipo_pagamento = item.tipo_pagamento;
      bigqueryTransacao.tipo_transacao = item.tipo_transacao;
      Object.keys(bigqueryTransacao).map((key) => {
        if (bigqueryTransacao[key] === null) {
          bigqueryTransacao[key] = undefined;
        }
      });
      return bigqueryTransacao;
    }

    if (!isAdmin) {
      query += ` AND CAST(o.documento AS STRING) = ?`;
      const queryResult = await this.bigqueryService.query(BigquerySource.smtr, query, [ordensPagamentoIdStr, cpfCnpj]);
      return queryResult.map((item: any) => {
        return mapBigQueryTransacaoAgrupado(item);
      });
    } else {
      const queryResult = await this.bigqueryService.query(BigquerySource.smtr, query, [ordensPagamentoIdStr]);
      return queryResult.map((item: any) => {
        return mapBigQueryTransacaoAgrupado(item);
      });
    }
  }

  private async queryData(args?: IBqFindTransacao): Promise<{
    data: BigqueryTransacao[]; //
    countAll: number;
  }> {
    const isBqProd = (await this.settingsService.getOneBySettingData(appSettings.any__bigquery_env, true)).getValueAsString() === BigqueryEnvironment.Production;
    const qArgs = this.getQueryArgs(isBqProd, args);
    const query =
      `
          SELECT CAST(t.data AS STRING) AS \`data\`, t.hora,
                 CAST(t.datetime_captura AS STRING)       AS datetime_captura,
                 CAST(t.datetime_transacao AS STRING)     AS datetime_transacao,
                 CAST(t.datetime_processamento AS STRING) AS datetime_processamento,
                 t.datetime_captura                       AS captureDateTime,
                 t.modo,
                 t.sentido,
                 t.id_veiculo,
                 t.id_cliente,
                 t.id_transacao,
                 t.${qArgs.tTipoPgto}                     AS tipo_pagamento,
                 t.tipo_transacao_smtr                    AS tipo_transacao,
                 t.id_tipo_integracao,
                 t.id_integracao,
                 t.latitude,
                 t.longitude,
                 t.stop_id,
                 t.stop_lat,
                 t.stop_lon,
                 t.valor_transacao,
                 t.valor_pagamento,
                 t.versao                                 AS bqDataVersion,
                 t.consorcio,
                 o.operadora_completo                     AS operadora,
                 t.id_consorcio,
                 t.id_operadora,
                 o.documento                              AS operadoraCpfCnpj,
                 c.cnpj                                   AS consorcioCnpj,
                 'ok'                                     AS status,
                 t.id_ordem_pagamento
          FROM \` ${qArgs.transacao}\` t
              LEFT JOIN \`rj-smtr.cadastro.operadoras\` o
          ON o.id_operadora = t.id_operadora
              LEFT JOIN \`rj-smtr.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio
      ` +
      '\n' +
      qArgs.joinIntegracao +
      '\n' +
      (qArgs.qWhere.length ? `WHERE ${qArgs.qWhere}\n` : '') +
      `\nORDER BY datetime_processamento DESC` +
      (qArgs?.limit !== undefined ? `\nLIMIT ${qArgs.limit + 1}` : '') +
      (qArgs?.offset !== undefined ? `\nOFFSET ${qArgs.offset}` : '');
    const queryResult = await this.bigqueryService.query(BigquerySource.smtr, query);

    const count = 0;
    // Remove unwanted keys and remove last item (all null if empty)
    let transacoes: BigqueryTransacao[] = queryResult.map((i) => {
      delete i.status;
      return i;
    });
    transacoes = this.mapBqTransacao(transacoes);

    return {
      data: transacoes,
      countAll: count,
    };
  }

  private getQueryArgs(isBqProd: boolean, args?: IBqFindTransacao) {
    const Q_CONSTS = {
      bucket: isBqProd ? 'rj-smtr' : 'rj-smtr-dev',
      transacao: isBqProd ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao' : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.transacao',
      integracao: isBqProd ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.integracao' : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.integracao',
      tTipoPgto: isBqProd ? 'tipo_pagamento' : 'id_tipo_pagamento',
    };
    // Args
    let offset = args?.offset;
    const queryBuilder = new QueryBuilder();
    queryBuilder.pushOR([]);
    if (args?.offset !== undefined && args.limit === undefined) {
      logWarn(this.logger, "fetchTicketRevenues(): 'offset' is defined but 'limit' is not." + " 'offset' will be ignored to prevent query fail");
      offset = undefined;
    }

    if (args?.startDate) {
      const startDate = args.startDate.toISOString();
      queryBuilder.pushAND(`DATE(t.datetime_processamento) >= DATE('${startDate}')`);
    }
    if (args?.endDate) {
      const endDate = args.endDate.toISOString();
      queryBuilder.pushAND(`DATE(t.datetime_processamento) <= DATE('${endDate}')`);
    }
    if (args?.previousDaysOnly === true) {
      queryBuilder.pushAND('DATE(t.datetime_processamento) > DATE(t.datetime_transacao)');
    }
    if (args?.nomeConsorcio?.in?.length) {
      queryBuilder.pushAND(`t.consorcio IN ('${args.nomeConsorcio.in.join("','")}')`);
    }
    if (args?.nomeConsorcio?.notIn?.length) {
      queryBuilder.pushAND(`t.consorcio NOT IN ('${args.nomeConsorcio.notIn.join("','")}')`);
    }
    if (args?.valor_pagamento !== undefined) {
      const _value = args.valor_pagamento;
      let value = '';
      if (Array.isArray(_value) && typeof _value[0] === 'number') {
        value = `${_value[0]} ${_value[1]}`;
      } else if (_value === null) {
        value = 'IS NULL';
      } else if (_value == 'NOT NULL') {
        value = 'IS NOT NULL';
      } else {
        value = `IN(${(_value as number[]).join(',')})`;
      }
      queryBuilder.pushAND(`t.valor_pagamento ${value}`);
    }
    if (args?.id_transacao !== undefined && args?.id_transacao?.length) {
      const _value = args.id_transacao;
      let value = `IN('${(_value as string[]).join("','")}')`;
      if (_value === null) {
        value = 'IS NULL';
      }
      queryBuilder.pushAND(`t.id_transacao ${value}`);
    }
    if (args?.id_operadora?.length) {
      queryBuilder.pushAND(`t.id_operadora IN('${args.id_operadora.join("','")}')`);
    }

    queryBuilder.pushOR([]);
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(t.datetime_processamento) = DATE('${nowStr}')`);
    }

    let qWhere = queryBuilder.toSQL();
    if (args?.cpfCnpj !== undefined) {
      const cpfCnpj = args.cpfCnpj;
      qWhere = isCpfOrCnpj(args?.cpfCnpj) === 'cpf' ? `o.documento = '${cpfCnpj}' AND (${qWhere})` : `c.cnpj = '${cpfCnpj}' AND (${qWhere})`;
    }
    if (args?.manyCpfCnpj && args.manyCpfCnpj.length > 0) {
      const cpfs = args.manyCpfCnpj.filter((i) => isCpfOrCnpj(i) === 'cpf');
      const cnpjs = args.manyCpfCnpj.filter((i) => isCpfOrCnpj(i) === 'cnpj');
      let where = '';
      if (cpfs.length > 0) {
        where += ` o.documento IN ('${cpfs.join(`','`)}')`;
      }
      if (cnpjs.length > 0) {
        if (where.length) {
          where += ' AND ';
        }
        where += ` c.cnpj IN ('${cnpjs.join(`','`)}')`;
      }
      if ((cpfs.length || cnpjs.length) && where) {
        qWhere = where + (qWhere ? ` AND (${qWhere})` : '');
      }
    }

    // Query
    const joinIntegracao = `LEFT JOIN ${Q_CONSTS.integracao} i ON i.id_transacao = t.id_transacao`;

    const countQuery =
      'SELECT COUNT(*) AS count ' +
      `FROM \`${Q_CONSTS.transacao}\` t\n
       LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora 
       LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio 
      ` +
      '\n' +
      joinIntegracao +
      '\n' +
      (qWhere.length ? ` WHERE ${qWhere}\n` : '');
    return {
      qWhere,
      bucket: Q_CONSTS.bucket,
      transacao: Q_CONSTS.transacao,
      integracao: Q_CONSTS.integracao,
      tTipoPgto: Q_CONSTS.tTipoPgto,
      joinIntegracao,
      countQuery,
      offset,
      limit: args?.limit,
    };
  }

  /**
   * Convert id or some values into desired string values
   */
  private mapBqTransacao(transacoes: BigqueryTransacao[]): BigqueryTransacao[] {
    return transacoes.map((item: BigqueryTransacao) => {
      const tipo_transacao = item.tipo_transacao;
      const tipo_pagamento = item.tipo_pagamento;
      const tipo_integracao = item.tipo_integracao;
      Object.values(TRIntegrationTypeMap[0]);
      return {
        ...item,
        valor_transacao: item.valor_transacao || 0,
        paymentMediaType: tipo_pagamento !== null ? BqTransacaoTipoPagamentoMap?.[tipo_pagamento] || tipo_pagamento : tipo_pagamento,
        transportIntegrationType: tipo_integracao !== null ? BqTsansacaoTipoIntegracaoMap?.[tipo_integracao] || tipo_integracao : tipo_integracao,
      };
    });
  }
}
