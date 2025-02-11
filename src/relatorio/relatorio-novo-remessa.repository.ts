import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from './dtos/relatorio-consolidado-novo-remessa.dto';
import { parseNumber } from '../cnab/utils/cnab/cnab-field-utils';
import { fi } from 'date-fns/locale';

@Injectable()
export class RelatorioNovoRemessaRepository {

  private static readonly QUERY_CONSOLIDADO_VANZEIROS = `
      select distinct op."userId", u."fullName", coalesce(da."valorLancamento", sum(op.valor)) as "valorTotal"
      from ordem_pagamento op
               inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
               join lateral (
          select opah.id,
                 opah."dataReferencia",
                 opah."statusRemessa",
                 opah."motivoStatusRemessa",
                 opah."ordemPagamentoAgrupadoId",
                 opah."userBankCode",
                 opah."userBankAgency",
                 opah."userBankAccount",
                 opah."userBankAccountDigit"
          from ordem_pagamento_agrupado_historico opah
          where opa.id = opah."ordemPagamentoAgrupadoId"
            and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
          ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
               inner join "user" u on op."userId" = u.id
          left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
          where 1 = 1
          and ("userId" = any($1) or $1 is null)
          and (
              ((date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null) and $7 = FALSE)
               or
              ((date_trunc('day', da."dataVencimento") BETWEEN $2 and $3 or $2 is null or $3 is null) and $7 = TRUE)
          )
          and ("statusRemessa" = any($4) or $4 is null)
          and u."cpfCnpj" not in ('18201378000119',
                                  '12464869000176',
                                  '12464539000180',
                                  '12464553000184',
                                  '44520687000161',
                                  '12464577000133')         
      group by op."userId", u."fullName", da."valorLancamento"
      having (sum(op.valor) >= $5 or $5 is null)
         and (sum(op.valor) <= $6 or $6 is null)
      order by u."fullName"
  `;


  private static readonly QUERY_CONSOLIDADO_CONSORCIOS = `
      select "fullName", sum("valorTotal") as "valorTotal"
      from (
               select "fullName",
                      coalesce(
                              (select "valorLancamento"
                               from detalhe_a da
                               where da."ordemPagamentoAgrupadoHistoricoId" = aux."ordemPagamentoAgrupadoHistoricoId"),
                              "valorTotal") as "valorTotal"
               from (
                        select distinct op."nomeConsorcio" as "fullName",
                                        sum(op.valor) as "valorTotal",
                                        opah."id" as "ordemPagamentoAgrupadoHistoricoId"
                        from ordem_pagamento op
                                 left join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
                                 left join lateral (
                            select opah.id,
                                   opah."dataReferencia",
                                   opah."statusRemessa",
                                   opah."motivoStatusRemessa",
                                   opah."ordemPagamentoAgrupadoId",
                                   opah."userBankCode",
                                   opah."userBankAgency",
                                   opah."userBankAccount",
                                   opah."userBankAccountDigit"
                            from ordem_pagamento_agrupado_historico opah
                            where opa.id = opah."ordemPagamentoAgrupadoId"
                              and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
                            ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
                                 inner join "user" u on op."userId" = u.id
                                 left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
                        where 1 = 1
                          and (
                            ((date_trunc('day', op."dataCaptura") BETWEEN $1 and $2 or $1 is null or $2 is null) and $7 = FALSE)
                                or
                            ((date_trunc('day', da."dataVencimento") BETWEEN $1 and $2 or $1 is null or $2 is null) and $7 = TRUE)
                            )
                          and ("statusRemessa" = any($3) or $3 is null or ("statusRemessa" is null and 1 = any($3)))
                          and (trim(upper("nomeConsorcio")) = any($4) or $4 is null)
                          and (op."nomeConsorcio" not in ('STPC', 'STPL', 'TEC'))
                        group by op."nomeConsorcio", opah.id, da."valorLancamento"
                    ) aux
           ) aux2
      where ("valorTotal" >= $5 or $5 is null) and ("valorTotal" <= $6 or $6 is null)
      group by "fullName"
      
      union

      select "fullName",
             sum("valorTotal") as "valorTotal"
      from (
               select distinct op."nomeConsorcio"        as "fullName",
                               coalesce(da."valorLancamento", opa."valorTotal") as "valorTotal",
                               opa.id
               from ordem_pagamento op
                        inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
                        inner join lateral (
                   select opah.id,
                          opah."dataReferencia",
                          opah."statusRemessa",
                          opah."motivoStatusRemessa",
                          opah."ordemPagamentoAgrupadoId",
                          opah."userBankCode",
                          opah."userBankAgency",
                          opah."userBankAccount",
                          opah."userBankAccountDigit"
                   from ordem_pagamento_agrupado_historico opah
                   where opa.id = opah."ordemPagamentoAgrupadoId"
                     and opah."dataReferencia" = (select max("dataReferencia")
                                                  from ordem_pagamento_agrupado_historico
                                                  where "ordemPagamentoAgrupadoId" = opa.id)
                   ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
                        inner join "user" u on op."userId" = u.id
                        left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
               where 1 = 1
                 and (
                   ((date_trunc('day', op."dataCaptura") BETWEEN $1 and $2 or $1 is null or $2 is null) and $7 = FALSE)
                       or
                   ((date_trunc('day', da."dataVencimento") BETWEEN $1 and $2 or $1 is null or $2 is null) and $7 = TRUE)
                   )
                 and ($3 is null or "statusRemessa" = any($3) or ("statusRemessa" is null and 1 = any($3)))
                 and (trim(upper("nomeConsorcio")) = any($4) or $4 is null)
                 and (op."nomeConsorcio" in ('STPC', 'STPL', 'TEC'))
           ) as oooud
      group by "fullName"
      having (sum("valorTotal") >= $5 or $5 is null) and (sum("valorTotal") <= $6 or $6 is null)
      order by "fullName"
  `;

  private static readonly QUERY_SINTETICO = `
    select op."userId", u."fullName", op.valor,
       CASE opah."statusRemessa"
              WHEN 3 THEN 'pago'
              WHEN 4 THEN 'naopago'
              ELSE 'apagar'
         END as status,
         opah."motivoStatusRemessa"
    from ordem_pagamento op
         inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
         join lateral (
    select opah."dataReferencia",
           opah."statusRemessa",
           opah."motivoStatusRemessa",
           opah."ordemPagamentoAgrupadoId",
           opah."userBankCode",
           opah."userBankAgency",
           opah."userBankAccount",
           opah."userBankAccountDigit"
    from ordem_pagamento_agrupado_historico opah
    where opa.id = opah."ordemPagamentoAgrupadoId"
      and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
    ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
         inner join "user" u on op."userId" = u.id
    and ("userId" = any($1) or $1 is null)
    and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
    and ("statusRemessa" = any($4) or $4 is null)
    and (trim(upper("nomeConsorcio")) = any($5) or $5 is null)
    and (op.valor >= $6 or $6 is null)
    and (op.valor <= $7 or $7 is null)
    order by u."fullName"`;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}
  private logger = new CustomLogger(RelatorioNovoRemessaRepository.name, { timestamp: true });

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => {  return c.toUpperCase().trim();});
    }

    const useDataPagamento= filter.pago || filter.erro;

    const parametersQueryVanzeiros =
      [
        filter.userIds || null,
        filter.dataInicio || null,
        filter.dataFim || null,
        this.getStatusParaFiltro(filter),
        filter.valorMin || null,
        filter.valorMax || null,
        useDataPagamento
      ];

    const parametersQueryConsorciosEModais =
      [
        filter.dataInicio || null,
        filter.dataFim || null,
        this.getStatusParaFiltro(filter),
        filter.consorcioNome || null,
        filter.valorMin || null,
        filter.valorMax || null,
        useDataPagamento
      ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result : any[] = [];
    let resultConsorciosEModais : any[] = [];
    let resultVanzeiros : any[] = [];

    if (filter.todosVanzeiros) {
      filter.userIds = undefined;
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.todosConsorcios) {
      filter.consorcioNome = undefined;
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    if (filter.userIds && filter.userIds.length > 0) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.consorcioNome && filter.consorcioNome.length > 0) {
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    // Nenhum critério, trás todos.
    if (!filter.todosVanzeiros &&
      !filter.todosConsorcios
      && (!filter.userIds || filter.userIds.length == 0) && (!filter.consorcioNome || filter.consorcioNome.length == 0)) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    result = resultVanzeiros.concat(resultConsorciosEModais);

    await queryRunner.release();
    const count = result.length;
    const valorTotal = result.reduce((acc, curr) => acc + parseFloat(curr.valorTotal), 0);
    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
    relatorioConsolidadoDto.valor = parseFloat(valorTotal);
    relatorioConsolidadoDto.count = count;
    relatorioConsolidadoDto.data = result
      .map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.fullName;
        elem.valor = parseFloat(r.valorTotal);
        return elem;
      });
    return relatorioConsolidadoDto;
  }

  public async findSintetico(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    this.logger.debug(RelatorioNovoRemessaRepository.QUERY_SINTETICO);

    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => {  return c.toUpperCase().trim();});
    }

    const parameters =
      [
        filter.userIds || null,
        filter.dataInicio || null,
        filter.dataFim || null,
        this.getStatusParaFiltro(filter),
        filter.consorcioNome || null,
        filter.valorMin || null,
        filter.valorMax || null
      ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO, parameters);
    await queryRunner.release();
    const count = result.length;
    const valorTotal = result.reduce((acc, curr) => acc + parseFloat(curr.valorTotal), 0);
    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
    relatorioConsolidadoDto.valor = parseFloat(valorTotal);
    relatorioConsolidadoDto.count = count;
    relatorioConsolidadoDto.data = result
      .map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.fullName;
        elem.valor = parseFloat(r.valorTotal);
        return elem;
      });
    return relatorioConsolidadoDto;
  }

  private getStatusParaFiltro(filter: IFindPublicacaoRelatorioNovoRemessa) {
    let statuses: number[] | null = null;
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar) {
      statuses = [];

      if (filter.aPagar) {
        statuses.push(0);
        statuses.push(1);
      }
      if (filter.emProcessamento) {
        statuses.push(2);
      }

      if (filter.pago) {
        statuses.push(3);
      }

      if (filter.erro) {
        statuses.push(4);
      }
    }
    return statuses;
  }
}