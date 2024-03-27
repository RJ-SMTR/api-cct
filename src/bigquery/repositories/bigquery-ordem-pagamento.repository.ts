import { Injectable, Logger } from '@nestjs/common';
import { PermissionarioRoleEnum } from 'src/permissionario-role/permissionario-role.enum';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingsService } from 'src/settings/settings.service';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { BQSInstances, BigqueryService } from '../bigquery.service';
import { BigqueryOrdemPagamento } from '../entities/ordem-pagamento.bigquery-entity';
import { IBigqueryFindOrdemPagamento } from '../interfaces/bigquery-find-ordem-pagamento.interface';

@Injectable()
export class BigqueryOrdemPagamentoRepository {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoRepository', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly settingsService: SettingsService,
  ) { }

  public async findMany(
    filter?: IBigqueryFindOrdemPagamento,
  ): Promise<BigqueryOrdemPagamento[]> {
    const transacoes: BigqueryOrdemPagamento[] = (await this.queryData(filter))
      .data;
    return transacoes;
  }

  private async queryData(
    args?: IBigqueryFindOrdemPagamento,
  ): Promise<{ data: BigqueryOrdemPagamento[]; countAll: number }> {
    const qArgs = await this.getQueryArgs(args);
    const query =
      `
      SELECT
        CAST(t.data_ordem AS STRING) AS dataOrdem,
        CAST(t.data_pagamento AS STRING) AS dataPagamento,
        t.id_consorcio AS idConsorcio,
        t.consorcio AS consorcio,
        t.id_operadora AS idOperadora,
        t.operadora AS operadora,
        t.servico AS servico,
        t.id_ordem_pagamento AS idOrdemPagamento,
        t.id_ordem_ressarcimento AS idOrdemRessarcimento,
        t.quantidade_transacao_debito AS quantidadeTransacaoDebito,
        t.valor_debito AS valorDebito,
        t.quantidade_transacao_especie AS quantidadeTransacaoEspecie,
        t.valor_especie AS valorEspecie,
        t.quantidade_transacao_gratuidade AS quantidadeTransacaoGratuidade,
        t.valor_gratuidade AS valorGratuidade,
        t.quantidade_transacao_integracao AS quantidadeTransacaoIntegracao,
        t.valor_integracao AS valorIntegracao,
        t.quantidade_transacao_rateio_credito AS quantidadeTransacaoRateioCredito,
        t.valor_rateio_credito AS valorRateioCredito,
        t.quantidade_transacao_rateio_debito AS quantidadeTransacaoRateioDebito,
        t.valor_rateio_debito AS valorRateioDebito,
        t.quantidade_total_transacao AS quantidadeTotalTransacao,
        t.valor_total_transacao_bruto AS valorTotalTransacaoBruto,
        t.valor_desconto_taxa AS valorDescontoTaxa,
        t.valor_total_transacao_liquido AS valorTotalTransacaoLiquido,
        t.quantidade_total_transacao_captura AS quantidadeTotalTransacaoCaptura,
        t.valor_total_transacao_captura AS valorTotalTransacaoCaptura,
        t.indicador_ordem_valida AS indicadorOrdemValida,
        t.versao AS versao,
        CAST(c.cnpj AS STRING) AS consorcioCpfCnpj,
        CAST(o.documento AS STRING) AS operadoraCpfCnpj,
        ${qArgs.favorecidoCpfCnpj} AS favorecidoCpfCnpj,
        ${qArgs.permissionarioRole} AS permissionarioRole,
        -- aux columns
        (${qArgs.countQuery}) AS count,
        'ok' AS status
      FROM \`${qArgs.ordemPagamento}\` t
      ${qArgs.joinConsorcios}
      ${qArgs.joinOperadoras}\n` +
      (qArgs.qWhere.length ? `WHERE ${qArgs.qWhere}\n` : '') +
      `UNION ALL
      SELECT ${'null, '.repeat(33)}
      (${qArgs.countQuery}) AS count, 'empty' AS status` +
      '\nORDER BY dataOrdem DESC, idOrdemPagamento DESC\n' +
      (qArgs?.limit !== undefined ? `\nLIMIT ${qArgs.limit + 1}` : '') +
      (qArgs?.offset !== undefined ? `\nOFFSET ${qArgs.offset}` : '');
    const queryResult = await this.bigqueryService.query(
      BQSInstances.smtr,
      query,
    );
    const count: number = queryResult[0].count;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamento[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });
    items.pop();

    return {
      data: items,
      countAll: count,
    };
  }

  private async getQueryArgs(args?: IBigqueryFindOrdemPagamento) {
    const IS_BQ_PROD =
      (
        await this.settingsService.getOneBySettingData(
          appSettings.any__bigquery_env,
          true,
        )
      ).getValueAsString() === BigqueryEnvironment.Production;
    const Q_CONSTS = {
      bucket: IS_BQ_PROD ? 'rj-smtr' : 'rj-smtr-dev',
      ordemPagamento: IS_BQ_PROD
        ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.ordem_pagamento'
        : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.ordem_pagamento',
      tTipoPgto: IS_BQ_PROD ? 'tipo_pagamento' : 'id_tipo_pagamento',
      favorecidoCpfCnpj: 'NULL',
      permissionarioRole:
        `CASE WHEN o.tipo_documento = 'CPF' THEN NULL ELSE ${PermissionarioRoleEnum.vanzeiro} END`,
    };

    // Args
    let offset = args?.offset;
    if (args?.offset !== undefined && args.limit === undefined) {
      this.logger.warn(
        "fetchTicketRevenues(): 'offset' is defined but 'limit' is not." +
        " 'offset' will be ignored to prevent query fail",
      );
      offset = undefined;
    }

    const queryBuilderDate = new QueryBuilder();
    queryBuilderDate.pushOR();
    if (args?.startDate) {
      const startDate = args.startDate.toISOString().slice(0, 10);
      queryBuilderDate.pushAND(`DATE(t.data_ordem) >= DATE('${startDate}')`);
    }
    if (args?.endDate) {
      const endDate = args.endDate.toISOString().slice(0, 10);
      queryBuilderDate.pushAND(`DATE(t.data_ordem) <= DATE('${endDate}')`);
    }
    if (args?.previousDaysOnly === true) {
      queryBuilderDate.pushAND('DATE(t.data_ordem) > DATE(t.datetime_transacao)');
    }

    queryBuilderDate.pushOR();
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilderDate.pushAND(`DATE(t.data_ordem) = DATE('${nowStr}')`);
    }

    const queryBuilder = new QueryBuilder();
    queryBuilder.pushAND(queryBuilderDate.toSQL());
    queryBuilder.pushAND(`t.indicador_ordem_valida IS TRUE`);

    if (args?.ignoreTransacaoLiquidoZero) {
      queryBuilder.pushAND(`t.valor_total_transacao_liquido > 0`)
    }

    if (args?.cpfCnpj !== undefined) {
      Q_CONSTS.favorecidoCpfCnpj = args.cpfCnpj;
      if (args?.permissionarioRole === PermissionarioRoleEnum.vanzeiro) {
        queryBuilder.pushAND(`o.documento = ${args.cpfCnpj}`);
      } else {
        queryBuilder.pushAND(`(o.documento = ${args.cpfCnpj} OR c.cnpj = ${args.cpfCnpj})`);
      }
    } else {
      Q_CONSTS.favorecidoCpfCnpj = args?.permissionarioRole === PermissionarioRoleEnum.vanzeiro
        ? `CASE WHEN o.tipo_documento = 'CPF' THEN o.documento ELSE NULL END`
        : `c.cnpj`;
      if (args?.permissionarioRole === PermissionarioRoleEnum.vanzeiro) {
        queryBuilder.pushAND(`o.tipo_documento = 'CPF'`);
      } else {
        queryBuilder.pushAND(`(o.tipo_documento = 'CNPJ' OR c.cnpj IS NOT NULL)`);
      }
    }

    const qWhere = queryBuilder.toSQL();

    // Query
    const joinOperadoras = `LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora `;
    const joinConsorcios = `LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio `;

    const countQuery =
      'SELECT COUNT(*) AS count ' +
      `FROM \`${Q_CONSTS.ordemPagamento}\` t\n` +
      `${joinOperadoras}\n` +
      `${joinConsorcios}\n` +
      (qWhere.length ? ` WHERE ${qWhere}\n` : '');
    return {
      qWhere,
      bucket: Q_CONSTS.bucket,
      ordemPagamento: Q_CONSTS.ordemPagamento,
      tTipoPgto: Q_CONSTS.tTipoPgto,
      joinOperadoras: joinOperadoras,
      joinConsorcios: joinConsorcios,
      favorecidoCpfCnpj: Q_CONSTS.favorecidoCpfCnpj,
      permissionarioRole: Q_CONSTS.permissionarioRole,
      countQuery,
      offset,
      limit: args?.limit,
    };
  }
}
