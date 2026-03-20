import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioSinteticoNovoRemessaConsorcio, RelatorioSinteticoNovoRemessaDia, RelatorioSinteticoNovoRemessaDto, RelatorioSinteticoNovoRemessaFavorecido } from '../dtos/relatorio-sintetico-novo-remessa.dto';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';


@Injectable()
export class RelatorioNovoRemessaRepository {

  private static readonly QUERY_SINTETICO_VANZEIROS = `
      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura",
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento", 
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'   
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
            op."nomeConsorcio",
            da.id "idDetalheA"
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
          and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
          and ("statusRemessa" = any($4) or $4 is null)
          and ("statusRemessa" not in (2, 3, 4))
          and u."cpfCnpj" not in ('18201378000119',
                                  '12464869000176',
                                  '12464539000180',
                                  '12464553000184',
                                  '44520687000161',
                                  '12464577000133')         
          and (op.valor >= $5 or $5 is null)
          and (op.valor <= $6 or $6 is null)
   
      union

      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura", 
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento",
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
             op."nomeConsorcio",
             da.id "idDetalheA"
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
               inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
      where 1 = 1
        and ("userId" = any($1) or $1 is null)
        and (date_trunc('day', da."dataVencimento") BETWEEN $2 and $3 or $2 is null or $3 is null)
        and ("statusRemessa" = any($4) or $4 is null)
        and ("statusRemessa" in (2, 3, 4))
        and u."cpfCnpj" not in ('18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133')
        and (da."valorLancamento" >= $5 or $5 is null)
        and (da."valorLancamento" <= $6 or $6 is null)
      order by "nomeConsorcio", "nomeFavorecido", "dataCaptura"
      `;

  private static readonly QUERY_SINTETICO_CONSORCIOS = `
      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura",
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento", 
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'   
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
             op."nomeConsorcio",
             da.id "idDetalheA"
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
            and (trim(upper("nomeConsorcio")) = any($1) or $1 is null)
            and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
            and ("statusRemessa" = any($4) or $4 is null)
            and ("statusRemessa" not in (2, 3, 4))
            and (op."nomeConsorcio" not in ('STPC', 'STPL', 'TEC'))    
            and (op.valor >= $5 or $5 is null)
            and (op.valor <= $6 or $6 is null)
   
      union

      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura", 
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento",
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
             op."nomeConsorcio",
             da.id "idDetalheA"
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
               inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
      where 1 = 1
        and (trim(upper("nomeConsorcio")) = any($1) or $1 is null)
        and (date_trunc('day', da."dataVencimento") BETWEEN $2 and $3 or $2 is null or $3 is null)
        and ("statusRemessa" = any($4) or $4 is null)
        and ("statusRemessa" in (2, 3, 4))
        and (op."nomeConsorcio" not in ('STPC', 'STPL', 'TEC'))
        and (da."valorLancamento" >= $5 or $5 is null)
        and (da."valorLancamento" <= $6 or $6 is null)
      order by "nomeConsorcio", "nomeFavorecido", "dataCaptura"
      `;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly relatorioNovoRemessaConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository,
  ) { }

  public async findSintetico(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioSinteticoNovoRemessaDto> {
    if (filter.consorcioNome) {

      filter.consorcioNome = filter.consorcioNome.map((c) => { return c.toUpperCase().trim(); });

    }

    const parametersQueryVanzeiros = [filter.userIds || null, filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.valorMin || null, filter.valorMax || null];

    const parametersQueryConsorciosEModais = [filter.consorcioNome || null, filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.valorMin || null, filter.valorMax || null];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = [];
    let resultConsorciosEModais: any[] = [];
    let resultVanzeiros: any[] = [];

    const mapModaisEConsorcios = await this.relatorioNovoRemessaConsolidadoRepository.obterTotalConsorciosEModais(filter, queryRunner);

    if (filter.todosVanzeiros) {
      filter.userIds = undefined;
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.todosConsorcios) {
      filter.consorcioNome = undefined;
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    if (filter.userIds && filter.userIds.length > 0) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.consorcioNome && filter.consorcioNome.length > 0) {
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    // Nenhum critério, trás todos.
    if (!filter.todosVanzeiros && !filter.todosConsorcios && (!filter.userIds || filter.userIds.length == 0) && (!filter.consorcioNome || filter.consorcioNome.length == 0)) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_VANZEIROS, parametersQueryVanzeiros);
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    result = resultVanzeiros.concat(resultConsorciosEModais);

    await queryRunner.release();
    const count = result.length;

    const relatorioSinteticoNovoRemessaDto = new RelatorioSinteticoNovoRemessaDto();
    relatorioSinteticoNovoRemessaDto.count = count;

    const elems: RelatorioSinteticoNovoRemessaDia[] = [];
    result.forEach((r) => {
      const elem = new RelatorioSinteticoNovoRemessaDia();
      elem.userId = r.userId;
      elem.dataCaptura = r.dataCaptura;
      elem.nomeFavorecido = r.nomeFavorecido;
      elem.dataPagamento = r.dataPagamento;
      elem.valorPagamento = r.valor;
      elem.status = r.status;
      elem.nomeConsorcio = r.nomeConsorcio;
      elems.push(elem);
    });

    // agrupa por consorcio
    const agrupamentoConsorcio = elems.reduce((acc, curr) => {
      if (!acc[curr.nomeConsorcio]) {
        acc[curr.nomeConsorcio] = [];
      }
      acc[curr.nomeConsorcio].push(curr);
      return acc;
    }, {});

    relatorioSinteticoNovoRemessaDto.agrupamentoConsorcio = [];

    for (const consorcio in agrupamentoConsorcio) {
      const agrupamentoFavorecido = agrupamentoConsorcio[consorcio].reduce((acc, curr) => {
        if (!acc[curr.nomeFavorecido]) {
          acc[curr.nomeFavorecido] = [];
        }
        acc[curr.nomeFavorecido].push(curr);
        return acc;
      }, {});

      for (const favorecido in agrupamentoFavorecido) {
        const agrupamentoDia = agrupamentoFavorecido[favorecido];
        const subtotalFavorecido = agrupamentoDia.reduce((acc, curr) => acc + parseFloat(curr.valorPagamento), 0);
        const relatorioFavorecido = new RelatorioSinteticoNovoRemessaFavorecido();
        relatorioFavorecido.subtotalFavorecido = parseFloat(subtotalFavorecido);
        relatorioFavorecido.nomeFavorecido = favorecido;
        relatorioFavorecido.agrupamentoDia = agrupamentoDia;
        agrupamentoFavorecido[favorecido] = relatorioFavorecido;
      }
      const relatorioConsorcio = new RelatorioSinteticoNovoRemessaConsorcio();

      relatorioConsorcio.subtotalConsorcio = mapModaisEConsorcios[consorcio];

      relatorioConsorcio.nomeConsorcio = consorcio;
      relatorioConsorcio.agrupamentoFavorecido = Object.values(agrupamentoFavorecido);

      relatorioSinteticoNovoRemessaDto.agrupamentoConsorcio.push(relatorioConsorcio);
    }
    // o total geral passa a ser o total dos consorcios
    relatorioSinteticoNovoRemessaDto.total = relatorioSinteticoNovoRemessaDto.agrupamentoConsorcio.reduce((acc, curr) => acc + curr.subtotalConsorcio, 0);
    return relatorioSinteticoNovoRemessaDto;
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
