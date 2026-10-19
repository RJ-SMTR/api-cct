import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';


@Injectable()
export class RelatorioNovoRemessaConsolidadoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaConsolidadoRepository.name, { timestamp: true });

  private readonly MODAIS = ['STPC', 'STPL', 'TEC'];

  private readonly CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM', 'TUSE', 'STPC', 'STPL', 'TEC', 'GTU'];

  private readonly headerQueryConsorciosApagar = ` select distinct CASE
                                                    WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE op."nomeConsorcio"
                                                    END AS "nome" ,  
                                                    pu."fullName" AS "nome2",                 
                                                    op."valor" AS valor, op."id" AS "idLinha"	`;

  private readonly headerQueryConsorcios = ` select distinct CASE
                                                WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                                WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                                WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                                WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                                ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                              END AS "nome" ,            
                                              coalesce(pu."fullName", puu."fullName") AS "nome2",        
                                              da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly headerQueryVanzeirosAPagar = ` select distinct pu."fullName" AS "nome",
                                                  op."nomeConsorcio" AS "nome2",                                                  
                                                  op."valor" AS valor, op."id" AS "idLinha"	`;

  private readonly headerQueryVanzeiros = ` select distinct coalesce(pu."fullName", puu."fullName") AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                            END AS "nome2",                                           
                                            da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly headerQueryEleicaoVanzereiroApagar = ` select distinct pu."fullName" AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome2", 
                                            op."valorTotalTransacaoLiquido" AS valor, op."id" AS "idLinha"`;


  private readonly headerQueryEleicaoConsorcioApagar = ` select distinct 
                                              CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome",pu."fullName" AS "nome2",                                             
                                            op."valorTotalTransacaoLiquido" AS valor, op."id" AS "idLinha"`;

  private readonly headerQueryEleicaoVanzeiro = ` select distinct pu."fullName" AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome2",                                           
                                            da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly headerQueryEleicaoConsorcio = ` select distinct 
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome",
                                            pu."fullName" AS "nome2",                                                                                       
                                            da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly fromQueryApagar = ` from ordem_pagamento op
                                        left join ordem_pagamento_agrupado opa  on op."ordemPagamentoAgrupadoId"=opa.id
                                        left join public.user pu on pu."id"=op."userId"	              
                                        left join ordem_pagamento_agrupado_historico oph on opa."id"= oph."ordemPagamentoAgrupadoId"
                                        left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = oph.id`;

  private readonly fromQueryPrincipal = ` from detalhe_a da
                                          left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"		 
                                          left join ordem_pagamento_agrupado opafi on opafi."id"=oph."ordemPagamentoAgrupadoId"
                                          left join ordem_pagamento_agrupado opai on opai."ordemPagamentoAgrupadoId"=oph."ordemPagamentoAgrupadoId"
                                          left join ordem_pagamento op on op."ordemPagamentoAgrupadoId"=opafi.id
                                          left join public.user pu on pu."id"=op."userId"
                                          left join ordem_pagamento opp on opp."ordemPagamentoAgrupadoId"=opai.id
                                          left join public.user puu on puu."id"=opp."userId" `;

  private readonly fromQueryEleicaoAPagar = ` from ordem_pagamento_unico op 
                                             left join public.user pu on pu."cpfCnpj"=op."operadoraCpfCnpj" `

  private readonly fromQueryEleicao = ` from detalhe_a da
                                        left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                        left join ordem_pagamento_agrupado opa on opa."id"=oph."ordemPagamentoAgrupadoId"
                                        left join ordem_pagamento_unico op on op."idOrdemPagamento"=opa."id"::varchar
                                        left join public.user pu on pu."cpfCnpj"=op."operadoraCpfCnpj" `;


  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  private getQueryApagarConsorcios(dataInicio: string, dataFim: string, aPagar?: boolean, pendente?: boolean): string {
    return ` ${this.headerQueryConsorciosApagar}                    
             ${this.fromQueryApagar}
             ${this.getWhereApagar(dataInicio, dataFim, aPagar, pendente)} `;
  }

  private getQueryApagarVanzeiros(dataInicio: string, dataFim: string, aPagar?: boolean, pendente?: boolean): string {
    return ` ${this.headerQueryVanzeirosAPagar}                    
             ${this.fromQueryApagar}  
             ${this.getWhereApagar(dataInicio, dataFim, aPagar, pendente)} `;
  }

  private getWhereApagar(dataInicio: string, dataFim: string, aPagar?: boolean, pendente?: boolean): string {
    const dataMinima = this.getDataMinima();
    const dataInicioDate = new Date(dataInicio);
    let where = ``;
    if (aPagar) {
      if (dataMinima && (dataMinima.getTime() >= dataInicioDate.getTime())) {
        dataInicio = dataMinima.toISOString();
      }
      where += ` where ((op."ordemPagamentoAgrupadoId" is null) OR (da.id is null))
               and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day'`;

    } else if (pendente) {
      // Atrasadas = ordens anteriores ao ciclo atual; a data final nunca passa do corte nem da data pedida.
      if (dataMinima) {
        const corte = new Date(dataMinima);
        corte.setDate(corte.getDate() - 2);
        if (corte.getTime() < new Date(dataFim).getTime()) {
          dataFim = corte.toISOString();
        }
      }
      where += ` where (op."ordemPagamentoAgrupadoId" is null) and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day'`;

    }
    return where;
  }

  private getQueryApagarEleicaoConsorcio(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryEleicaoConsorcioApagar}
             ${this.fromQueryEleicaoAPagar}
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' AND op."idOrdemPagamento" is null`;
  }

  private getQueryApagarEleicaoVanzeiro(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryEleicaoVanzereiroApagar}
             ${this.fromQueryEleicaoAPagar}
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' AND op."idOrdemPagamento" is null`;
  }

  private getQueryConsorcios(dataInicio: String, dataFim: String): string {
    return `   ${this.headerQueryConsorcios}
               ${this.fromQueryPrincipal}
               where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  private getQueryVanzeiros(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryVanzeiros}
              ${this.fromQueryPrincipal}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  private getQueryEleicaoConsorcio(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryEleicaoConsorcio}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  private getQueryEleicaoVanzeiro(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryEleicaoVanzeiro}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {

    const dataInicio = filter.dataInicio.toISOString().split('T')[0];
    const dataFim = filter.dataFim.toISOString().split('T')[0];

    let queryAPagarConsorcios = ``;

    let queryAPagarVanzeiros = ``;

    let queryConsorcios = ``;

    let queryVanzeiros = ``;

    let queryAPagarEleicaoConsorcio = ``;

    let queryAPagarEleicaoVanzeiro = ``;

    let queryEleicaoConsorcio = ``;

    let queryEleicaoVanzeiro = ``;

    let queryPendentesConsorcio = ``;

    let queryPendentesVanzeiro = ``;

    // ---- Quais grupos de consulta o filtro de status pede ----
    // aPagar:    ordens da janela atual ainda sem pagamento.
    // atrasadas: "OPs atrasadas" (ordens antigas sem agrupamento). Não existem na modalidade Eleição.
    // historico: pagamentos já remetidos (detalhe_a), filtrados por statusRemessa / motivoStatusRemessa.
    const semFiltroStatus = !(
      filter.aPagar || filter.pendentes || filter.erro || filter.pago || filter.emProcessamento
      || filter.pendenciaPaga || filter.rejeitado || filter.estorno
    );
    const temEleicao = !!filter.eleicao;
    const querAPagar = semFiltroStatus || !!filter.aPagar;
    const querAtrasadas = !temEleicao && (semFiltroStatus || !!filter.pendentes || !!filter.erro);
    const querHistorico = semFiltroStatus || !!(
      filter.pago || filter.emProcessamento || filter.pendenciaPaga || filter.rejeitado || filter.estorno || filter.erro
    );

    if (querAPagar) {
      queryAPagarConsorcios = this.getQueryApagarConsorcios(dataInicio, dataFim, true);
      queryAPagarVanzeiros = this.getQueryApagarVanzeiros(dataInicio, dataFim, true);
      queryAPagarEleicaoConsorcio = this.getQueryApagarEleicaoConsorcio(dataInicio, dataFim);
      queryAPagarEleicaoVanzeiro = this.getQueryApagarEleicaoVanzeiro(dataInicio, dataFim);
    }
    if (querAtrasadas) {
      queryPendentesConsorcio = this.getQueryApagarConsorcios(dataInicio, dataFim, undefined, true);
      queryPendentesVanzeiro = this.getQueryApagarVanzeiros(dataInicio, dataFim, undefined, true);
    }
    if (querHistorico) {
      queryConsorcios = this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros = this.getQueryVanzeiros(dataInicio, dataFim);
      queryEleicaoConsorcio = this.getQueryEleicaoConsorcio(dataInicio, dataFim);
      queryEleicaoVanzeiro = this.getQueryEleicaoVanzeiro(dataInicio, dataFim);
    }

    // Só acrescenta um trecho a uma consulta que existe (evita sobrar "AND ..." solto no UNION).
    const anexar = (query: string, trecho: string) => (query === `` ? query : query + trecho);

    //Tipo de pesquisa: filter.todosVanzeiros,filter.todosConsorcios,filter.consorcioNome,filter.userIds
    if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
      if (!filter.todosVanzeiros) {
        const userPlaceholders = (filter.userIds ?? []).map((id) => Number(id)).join(`','`);
        // No histórico o favorecido pode vir da ordem do próprio agrupado (pu) ou da ordem do agrupado
        // "pai" (puu, pendência paga); filtrar só por pu escondia esses pagamentos.
        queryVanzeiros = anexar(queryVanzeiros, ` AND (pu."id" IN('${userPlaceholders}') OR puu."id" IN('${userPlaceholders}')) `);
        const usersVanzeiros = ` AND pu."id" IN('${userPlaceholders}') `;
        queryAPagarVanzeiros = anexar(queryAPagarVanzeiros, usersVanzeiros);
        queryAPagarEleicaoVanzeiro = anexar(queryAPagarEleicaoVanzeiro, usersVanzeiros);
        queryPendentesVanzeiro = anexar(queryPendentesVanzeiro, usersVanzeiros);
        queryEleicaoVanzeiro = anexar(queryEleicaoVanzeiro, usersVanzeiros);
      } else {
        const consorcioPlaceholders = this.MODAIS.join(`','`);
        queryPendentesVanzeiro = anexar(queryPendentesVanzeiro, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`);
        queryVanzeiros = anexar(queryVanzeiros, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}'))
                            AND (length(op."operadoraCpfCnpj")<=11  or length(opp."operadoraCpfCnpj")<=11) `);
        queryAPagarVanzeiros = anexar(queryAPagarVanzeiros, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`);
        // ordem_pagamento_unico (Eleição) não tem "nomeConsorcio": a coluna é "consorcio".
        queryAPagarEleicaoVanzeiro = anexar(queryAPagarEleicaoVanzeiro, ` AND op."consorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `);
      }
    }

    if ((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) {
      const nomes = filter.todosConsorcios ? this.CONSORCIOS : (filter.consorcioNome ?? []);
      const consorcioPlaceholders = nomes.join(`','`);
      queryAPagarConsorcios = anexar(queryAPagarConsorcios, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
      queryConsorcios = anexar(queryConsorcios, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}'))  `);
      queryAPagarEleicaoConsorcio = anexar(queryAPagarEleicaoConsorcio, ` AND op."consorcio" IN('${consorcioPlaceholders}') `);
      queryEleicaoConsorcio = anexar(queryEleicaoConsorcio, ` AND op."consorcio" IN('${consorcioPlaceholders}') `);
      queryPendentesConsorcio = anexar(queryPendentesConsorcio, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
    }

    // Filtro de status do histórico: status (remessa) e motivo (rejeitado/estorno) se somam com OR,
    // sempre dentro de um único grupo entre parênteses.
    //   Aguardando = 1,2 | Pago = 3 | Pendência paga = 5 | Pendência de pagamento (Todos) = 4
    //   Rejeitado = motivo AL/HO/ANHO | Estorno = motivo 02
    const status: number[] = [];
    const subErroStatus: string[] = [];

    if (filter.emProcessamento) {
      status.push(1);
      status.push(2);
    }
    if (filter.pago) status.push(3);
    if (filter.erro) status.push(4);
    if (filter.pendenciaPaga) status.push(5);
    // "Todos" da pendência de pagamento inclui sempre o que Rejeitado e Estorno trazem.
    if (filter.rejeitado || filter.erro) subErroStatus.push('AL', 'HO', 'ANHO');
    if (filter.estorno || filter.erro) subErroStatus.push('02');

    const condicoesStatus: string[] = [];
    if (subErroStatus.length > 0) {
      condicoesStatus.push(`oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')})`);
    }
    if (status.length > 0) {
      condicoesStatus.push(`oph."statusRemessa" IN (${status.join(',')})`);
    }

    if (condicoesStatus.length > 0) {
      const filtroStatus = ` AND (${condicoesStatus.join(' OR ')}) `;
      queryConsorcios = anexar(queryConsorcios, filtroStatus);
      queryVanzeiros = anexar(queryVanzeiros, filtroStatus);
      queryEleicaoConsorcio = anexar(queryEleicaoConsorcio, filtroStatus);
      queryEleicaoVanzeiro = anexar(queryEleicaoVanzeiro, filtroStatus);
    }

    const params: any[] = [];
    let paramIndex = 1;

    const queries: string[] = [];

    const temFiltroConsorcio = (filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios;
    const temFiltroVanzeiros = (filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros;

    // Se não marcou nenhum dos dois, é busca geral = busca os dois
    const buscarConsorcio = temFiltroConsorcio || !temFiltroVanzeiros;
    const buscarVanzeiro = temFiltroVanzeiros || !temFiltroConsorcio;

    if (querAPagar) {
      if (buscarConsorcio) queries.push(temEleicao ? queryAPagarEleicaoConsorcio : queryAPagarConsorcios);
      if (buscarVanzeiro) queries.push(temEleicao ? queryAPagarEleicaoVanzeiro : queryAPagarVanzeiros);
    }

    if (querAtrasadas) {
      if (buscarConsorcio) queries.push(queryPendentesConsorcio);
      if (buscarVanzeiro) queries.push(queryPendentesVanzeiro);
    }

    if (querHistorico) {
      if (buscarConsorcio) queries.push(temEleicao ? queryEleicaoConsorcio : queryConsorcios);
      if (buscarVanzeiro) queries.push(temEleicao ? queryEleicaoVanzeiro : queryVanzeiros);
    }

    // Junta só as queries que realmente existem
    const parts = queries.filter(q => q !== ``);

    let query = ``;

    if (parts.length === 0) {
      // nada pra buscar
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
        valor: 0,
      });
    }

    query = `SELECT "nome", SUM("valor") AS "valor" FROM (${parts.join(' UNION ALL ')}) AS R WHERE  (R."nome" is not null AND R."nome2" is not null)  `;

    query += ` GROUP BY "nome" `;

    // valor: filter.valorMin, filter.valorMax
    if (filter.valorMin !== undefined && filter.valorMax !== undefined) {
      query += ` HAVING SUM(valor) between $${paramIndex++} AND $${paramIndex++}`;
      params.push(filter.valorMin, filter.valorMax);
    } else if (filter.valorMin !== undefined) {
      query += ` HAVING SUM(valor) >= $${paramIndex++}`;
      params.push(filter.valorMin);
    } else if (filter.valorMax !== undefined) {
      query += `HAVING SUM(valor) <= $${paramIndex++}`;
      params.push(filter.valorMax);
    }

    query += ` ORDER BY "nome" ASC `;

    const hasPagination = filter.page !== undefined && filter.pageSize !== undefined;
    const baseParams = [...params];

    let paginatedQuery = query;

    if (hasPagination) {
      const page = filter.page as number;
      const pageSize = filter.pageSize as number;
      const offset = (page - 1) * pageSize;
      paginatedQuery = `SELECT *, COUNT(*) OVER() AS "totalCount" FROM (${query}) AS P LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(pageSize, offset);
    }

    this.logger.debug(`Executing query: ${paginatedQuery} with params: ${params.join(', ')}`, RelatorioNovoRemessaConsolidadoRepository.name);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    let result: any[];
    let valorTotal = 0;

    try {
      result = await queryRunner.query(paginatedQuery, params);

      if (hasPagination) {
        const totalRows = await queryRunner.query(query, baseParams);
        valorTotal = totalRows.reduce((acc: number, curr: { valor: any; }) => acc + parseFloat(String(curr.valor)), 0);
      }
    } finally {
      await queryRunner.release();
    }

    const mappedResults = result.map((r) => {
      const elem = new RelatorioConsolidadoNovoRemessaData();
      elem.nomefavorecido = r.nome;
      elem.valor = parseFloat(String(r.valor));
      return elem;
    });

    const totalCount = hasPagination
      ? (result.length > 0 ? parseInt(String(result[0].totalCount), 10) : 0)
      : mappedResults.length;

    return new RelatorioConsolidadoNovoRemessaDto({
      data: mappedResults,
      count: totalCount,
      valor: hasPagination ? valorTotal : mappedResults.reduce((acc: any, curr: { valor: any; }) => acc + curr.valor, 0),
    });
  }

  getDataMinima(hoje = new Date()) {
    const dia = hoje.getDay(); // 0=Dom, 2=Ter, 6=Sab
    const data = new Date(hoje);
    data.setHours(0, 0, 0, 0);

    // TERÇA, QUARTA, QUINTA -> mínima é TERÇA
    if ([2, 3, 4].includes(dia)) {
      data.setDate(data.getDate() - (dia - 2));
      return data;
    }

    // SEXTA ,SÁBADO, DOMINGO, SEGUNDA -> mínima é SEXTA
    if ([6, 0, 1, 5].includes(dia)) {
      let diff = 0;
      if (dia === 0) diff = 1; // Dom -> volta 1
      if (dia === 1) diff = 2; // Seg -> volta 2
      if (dia === 5) diff = 3; // Seg -> volta 3
      data.setDate(data.getDate() - diff);
      return data;
    }
  }

  getDataMaxima(hoje = new Date()) {
    const dia = hoje.getDay();
    const minima = this.getDataMinima(hoje);
    if (!minima) return null;

    const maxima = new Date(minima);

    if ([2, 3, 4].includes(dia)) {
      // Terça -> Quarta
      maxima.setDate(minima.getDate() + 1);
    } else if ([6, 0, 1].includes(dia)) {
      // Sábado -> Segunda
      maxima.setDate(minima.getDate() + 2);
    }

    maxima.setHours(23, 59, 59, 999);
    return maxima;
  }
}
