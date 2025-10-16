import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';
import { OrdemPagamentoPendenteDto } from '../dto/ordem-pagamento-pendente.dto';
import { OrdemPagamentoPendenteNuncaRemetidasDto } from '../dto/ordem-pagamento-pendente-nunca-remetidas.dto';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { getStatusRemessaEnumByValue } from '../../enums/novo-remessa/status-remessa.enum';
import { OcorrenciaEnum } from '../../enums/ocorrencia.enum';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { OrdemPagamentoUnicoDto } from '../dto/ordem-pagamento-unico.dto';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { formatDateISODate } from 'src/utils/date-utils';
import { format, getMonth, getYear, isFriday, isTuesday, max, subDays } from 'date-fns';

@Injectable()
export class OrdemPagamentoRepository {

  private logger = new CustomLogger(OrdemPagamentoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamento)
    private ordemPagamentoRepository: Repository<OrdemPagamento>,
    private readonly dataSource: DataSource
  ) { }


  public async save(dto: DeepPartial<OrdemPagamento>): Promise<OrdemPagamento> {
    const existing = await this.ordemPagamentoRepository.findOneBy({ id: dto.id });
    if (existing) {
      return existing;
    }
    const createdOrdem = this.ordemPagamentoRepository.create(dto);
    return this.ordemPagamentoRepository.save(createdOrdem);
  }

  public async findOne(fields: EntityCondition<OrdemPagamento>): Promise<Nullable<OrdemPagamento>> {
    return await this.ordemPagamentoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(fields: EntityCondition<OrdemPagamento>): Promise<OrdemPagamento[]> {
    return await this.ordemPagamentoRepository.find({
      where: fields,
    });
  }

  public async findOrdensPagamentoAgrupadasPorMes(userId: number, targetDate: Date): Promise<OrdemPagamentoAgrupadoMensalDto[]> {
    const query = `
WITH
    historico_recente AS (
        SELECT DISTINCT
            ON ("ordemPagamentoAgrupadoId") *
        FROM
            ordem_pagamento_agrupado_historico
        ORDER BY
            "ordemPagamentoAgrupadoId",
            "dataReferencia" DESC
    ),
    dias_relatorio AS (
        SELECT dias::DATE AS data
        FROM generate_series(
               DATE_TRUNC('month', $1::DATE), DATE_TRUNC('month', $1::DATE) + INTERVAL '1 month' - INTERVAL '1 day', '1 day'::INTERVAL
            ) AS dias
        WHERE (
                EXTRACT(
                    MONTH
                    FROM dias
                ) < 9
                AND EXTRACT(
                    DOW
                    FROM dias
                ) = 5
            )
            OR (
                EXTRACT(
                    MONTH
                    FROM dias
                ) >= 9
                AND EXTRACT(
                    DOW
                    FROM dias
                ) IN (2, 5)
            )
    )
SELECT
   dr.data,
    SUM(dp.valor) AS valor,
    MIN(dp."valorTotal") AS valor_total_agrupado,
    (dr.data - 1) AS data_final_operacoes,
    (dr.data - 7) AS data_inicial_operacoes,
    dp."dataReferencia",
    dp.opa_id AS opaId,
    dp."statusRemessa",
    dp."motivoStatusRemessa",
    dp.data_pagamento,
    dp.opa_origem_id
FROM
    dias_relatorio dr
   LEFT JOIN LATERAL (
        SELECT
            op.valor,
            opa."valorTotal",
            oph."dataReferencia",
            oph."statusRemessa",
            oph."motivoStatusRemessa",
     opa.id AS opa_id,
            opa."dataPagamento" AS data_pagamento,
            opa."ordemPagamentoAgrupadoId" AS opa_origem_id
        FROM
            ordem_pagamento op
            JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
            JOIN historico_recente oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        WHERE
            op."userId" = $2
            AND (
            opa."dataPagamento"::DATE = dr.data

OR (
                
                    opa."ordemPagamentoAgrupadoId" IS NULL

                and    op."dataOrdem"::DATE BETWEEN (
    dr.data - CASE
        WHEN EXTRACT(
            MONTH
            FROM dr.data
        ) >= 9 THEN 3
        ELSE 7
    END
) AND (dr.data - 1)
                    AND oph."statusRemessa" NOT IN (3, 4)
                    AND opa."dataPagamento"::DATE > dr.data
                )
            )
    ) dp ON TRUE
GROUP BY
    dr.data,
    dp.data_pagamento,
    dp.opa_origem_id,
    dp.opa_id,
    dp."dataReferencia",
    dp."statusRemessa",
    dp."motivoStatusRemessa"
ORDER BY dr.data;

`;

    const result = await this.ordemPagamentoRepository.query(query, [targetDate, userId]);
    return result.map((row: any) => {
      const dto = new OrdemPagamentoAgrupadoMensalDto();
      dto.data = row.data;
      dto.ordemPagamentoAgrupadoId = row.opaid;
      dto.dataPagamento = row.dataReferencia;
      dto.valorTotal = row.valor != null ? parseFloat(row.valor) : 0;
      if (row.motivoStatusRemessa != null) {
        dto.motivoStatusRemessa = row.motivoStatusRemessa;
        dto.descricaoMotivoStatusRemessa = OcorrenciaEnum[row.motivoStatusRemessa];
      }
      if (row.statusRemessa != null) {
        dto.statusRemessa = row.statusRemessa;
        dto.descricaoStatusRemessa = getStatusRemessaEnumByValue(row.statusRemessa);
      }

      return dto;
    });
  }


  /***
   * Obtém as ordens que foram agrupadas mas o pagamento falhou.
   * Existem dois tipos de falhas:
   * - Falhas nas quais o usuário deve modificar os dados bancários.
   * - Falhas nas quais houve um erro desconhecido no arquivo de retorno do banco
   * Não são retornadas ordens que o usuário não modificou os dados bancários caso houveram os erros referentes a conta
   * do usuário.
   * @returns OrdemPagamentoPendenteDto[] - Lista de ordens de pagamento pendentes
   *  */


  /***
        Busca as ordens que não foram agrupadas e pagas
        São ignoradas as seguintes situações
        situações:
        - Usuário não cadastrou dados bancários
        - Usuário não se cadastrou no CCT, e foi gerada uma ordem com ID null
   @param userId - Id do usuário (opcional)
   @returns OrdemPagamentoPendenteNuncaRemetidasDto[] - Lista de ordens de pagamento pendentes
   */
  public async findOrdensPagamentosPendentesQueNuncaForamRemetidas(userId?: number | undefined): Promise<OrdemPagamentoPendenteNuncaRemetidasDto[]> {
    let query = `
        select o.id,
               o.valor,
               o."dataOrdem",
               "userId",
               "ultimaDataPagamento"
        from ordem_pagamento o
                 left join ordem_pagamento_agrupado opa
                           on o."ordemPagamentoAgrupadoId" = opa.id
                 left join "user" u
                           on o."userId" = u.id
                 inner join lateral (
                      select date_trunc('day', max(opa2."dataPagamento")) as "ultimaDataPagamento"
                      from ordem_pagamento_agrupado opa2
                      where date_trunc('day', opa2."dataPagamento") <= date_trunc('day', current_date)
                ) ultimo_pagamento
                on true
        where 1 = 1
          and opa.id is null
          and (
                o."userId" is not null
                and u."bankAccount" is not null
                and u."bankAgency" is not null
                and u."bankCode" is not null
                and u."bankAccountDigit" is not null
            )
          and date_trunc('day', "dataOrdem") <= ultimo_pagamento."ultimaDataPagamento"`;
    if (userId) {
      query += ` and o."userId" = $1`;
      const result = await this.ordemPagamentoRepository.query(query, [userId]);
      return result.map((row: any) => {
        const ordemPagamentoPendente = new OrdemPagamentoPendenteNuncaRemetidasDto();
        ordemPagamentoPendente.id = row.id;
        ordemPagamentoPendente.valor = row.valor ? parseFloat(Number(row.valor).toFixed(2)) : 0;
        ordemPagamentoPendente.userId = row.userId;
        ordemPagamentoPendente.dataOrdem = row.dataOrdem;
        return ordemPagamentoPendente;
      });
    } else {
      const result = await this.ordemPagamentoRepository.query(query);
      return result.map((row: any) => {
        const ordemPagamentoPendente = new OrdemPagamentoPendenteNuncaRemetidasDto();
        ordemPagamentoPendente.id = row.id;
        ordemPagamentoPendente.valor = row.valor ? parseFloat(Number(row.valor).toFixed(2)) : 0;
        ordemPagamentoPendente.userId = row.userId;
        ordemPagamentoPendente.dataOrdem = row.dataOrdem;
        return ordemPagamentoPendente;
      });
    }
  }

  public async findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    const query = `
        SELECT o.id,
               ROUND(valor, 2) valor,
               o."dataOrdem"
        FROM ordem_pagamento o
        INNER JOIN ordem_pagamento_agrupado opa
        ON o."ordemPagamentoAgrupadoId" = opa.id
        WHERE 1 = 1
          AND opa.id = $1
          AND o."dataCaptura" IS NOT NULL
          AND o."userId" = $2
          AND date_trunc('day', o."dataOrdem") BETWEEN date_trunc('day', "dataPagamento") - INTERVAL '7 days' AND date_trunc('day', "dataPagamento") - INTERVAL '1 day'
        ORDER BY o."dataOrdem" desc
    `;

    const result = await this.ordemPagamentoRepository.query(query, [ordemPagamentoAgrupadoId, userId]);
    return result.map((row: any) => {
      const ordemPagamento = new OrdemPagamentoSemanalDto();
      ordemPagamento.ordemId = row.id;
      ordemPagamento.dataOrdem = row.dataOrdem;
      ordemPagamento.valor = row.valor ? parseFloat(row.valor) : 0;
      return ordemPagamento;
    });
  }

  public async findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(
    ordemPagamentoAgrupadoId: number,
    userId: number,
    endDateParam?: Date
  ): Promise<OrdemPagamentoSemanalDto[]> {
    const params: any[] = [ordemPagamentoAgrupadoId, userId];
    let whereData = '';

    if (endDateParam) {
      const today = new Date(endDateParam);
      const isAntesDeSetembro2025 = getYear(today) === 2025 && getMonth(today) < 8;
      let subDaysInt = 0;

      if (isAntesDeSetembro2025) {
        subDaysInt = 7;
      } else if (isFriday(today)) {
        subDaysInt = 3;
      } else if (isTuesday(today)) {
        subDaysInt = 4;
      }

      const dataCalculada = subDays(today, subDaysInt);
      const dataLimite = new Date('2025-01-01');
      const dataInicio = format(max([dataCalculada, dataLimite]), 'yyyy-MM-dd');

      const dataFim = format(subDays(today, 1), 'yyyy-MM-dd');

      whereData = `AND o."dataOrdem" BETWEEN $3 AND $4
      GROUP BY o.id,  o."dataOrdem", o."dataCaptura"`;
      params.push(dataInicio, dataFim);
    }

    const query = `
    SELECT
          o.id,
           MAX(ROUND(valor, 2)) as valor,
            date_trunc('day', o."dataCaptura") "dataCaptura",
           o."dataOrdem"
    FROM ordem_pagamento o
    INNER JOIN ordem_pagamento_agrupado opa
    ON o."ordemPagamentoAgrupadoId" = opa.id
    WHERE 1 = 1
      AND opa.id = $1
      AND o."dataCaptura" IS NOT NULL
      AND o."userId" = $2
      ${whereData}
    ORDER BY o."dataCaptura" DESC
  `;


    let result = await this.ordemPagamentoRepository.query(query, params);

    result = result.map((row: any) => {
      const ordemPagamento = new OrdemPagamentoSemanalDto();
      ordemPagamento.ordemId = row.id;
      ordemPagamento.dataCaptura = row.dataCaptura;
      ordemPagamento.valor = row.valor ? parseFloat(row.valor) : 0;
      return ordemPagamento;
    });

    const resultGrouped: OrdemPagamentoSemanalDto[] = [];

    for (const row of result) {
      const existing = resultGrouped.find(
        (item) => item.dataCaptura?.toISOString() === row.dataCaptura.toISOString()
      );
      if (existing) {
        existing.valor += row.valor;
        if (!existing.ids) {
          existing.ids = [];
        }
        existing.ids.push(row.ordemId);
        existing.ordemId = undefined;
      } else {
        row.ids = [row.ordemId];
        row.ordemId = undefined;
        resultGrouped.push(row);
      }
    }

    return resultGrouped;
  }


  public async findOrdensPagamentoDiasAnterioresByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    const query = `
        SELECT SUM(ROUND(valor, 2)) valor,
               o."dataOrdem",
               o."dataCaptura"
        FROM ordem_pagamento o
        INNER JOIN ordem_pagamento_agrupado opa
        ON o."ordemPagamentoAgrupadoId" = opa.id
        WHERE 1 = 1
          AND opa.id = $1
          AND o."dataCaptura" IS NOT NULL
          AND o."userId" = $2
          AND date_trunc('day', o."dataOrdem") < date_trunc('day', "dataPagamento") - INTERVAL '7 days'
        GROUP BY o."dataOrdem", o."dataCaptura"
        ORDER BY o."dataOrdem" desc
    `;

    const result = await this.ordemPagamentoRepository.query(query, [ordemPagamentoAgrupadoId, userId]);
    return result.map((row: any) => {
      const ordemPagamento = new OrdemPagamentoSemanalDto();
      ordemPagamento.dataOrdem = row.dataOrdem;
      ordemPagamento.valor = row.valor ? parseFloat(row.valor) : 0;
      ordemPagamento.dataCaptura = row.dataCaptura;
      return ordemPagamento;
    });
  }

  public async agruparOrdensDePagamento(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador, consorcios: string[]): Promise<void> {
    const dtInicialStr = dataInicial.toISOString().split('T')[0];
    const dtFinalStr = dataFinal.toISOString().split('T')[0];
    const dtPgtoStr = dataPgto.toISOString().split('T')[0];
    const consorciosJoin = consorcios.join(',');
    await this.ordemPagamentoRepository.query(`CALL P_AGRUPAR_ORDENS($1, $2, $3, $4, $5)`, [`${dtInicialStr} 00:00:00`, `${dtFinalStr} 23:59:59`, dtPgtoStr, pagador.id, `{${consorciosJoin}}`]);
  }

  public async agruparOrdensDePagamentoUnico(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador): Promise<void> {
    const dtInicialStr = dataInicial.toISOString().split('T')[0];
    const dtFinalStr = dataFinal.toISOString().split('T')[0];
    const dtPgtoStr = dataPgto.toISOString().split('T')[0];
    await this.ordemPagamentoRepository.query(`CALL p_agrupar_ordem_pagamento_unico($1, $2, $3, $4)`, [`${dtInicialStr}`, `${dtFinalStr}`, dtPgtoStr, pagador.id]);
  }

  async findNumeroOrdensPorIntervaloDataCaptura(startDate: Date, endDate: Date) {
    // Query max dataCaptura
    const query = `SELECT COUNT(*) as qtde FROM ordem_pagamento op 
                    where date_trunc('day', "dataCaptura") between $1 and $2`;
    const result = await this.ordemPagamentoRepository.query(query, [startDate, endDate]);
    if (result.length > 0) {
      return parseFloat(result[0].qtde);
    }
    return Promise.resolve(undefined);
  }


  public async findOrdensPagamentosPendentes(dataInicio: Date, dataFim: Date, nomes: string[]): Promise<OrdemPagamentoPendenteDto[]> {
    const dataIniForm = formatDateISODate(dataInicio)
    const dataFimForm = formatDateISODate(dataFim)

    const query = `
      --QUERY RETORNA TODOS OS PAGAMENTOS NÃO PROCESSADOS
      SELECT DISTINCT it."idOrdemPagamento",uu."fullName" nome,it."dataOrdem",it."nomeConsorcio" AS consorcio,it."valor"            
      from item_transacao it 
      left join public.user uu on uu."permitCode"=it."idOperadora"
      where it."dataOrdem" between '${dataIniForm}' and '${dataFimForm}'
      and it."nomeConsorcio" in('STPC','STPL','TEC')
      and uu."fullName" in('${nomes?.join("','")}')

      union all

      --QUERY RETORNA TODOS OS PAGAMENTOS PENDENTES - ESTORNADOS E REJEITADOS QUE A PESSOA TENHA RECEBIDO ALGUM PAGAMENTOS APÓS 2024
      SELECT DISTINCT it."idOrdemPagamento",uu."fullName" nome,it."dataOrdem",it."nomeConsorcio" AS consorcio,it."valor"       
      from item_transacao it 
      left join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId"=ita.id
      left join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
      left join detalhe_a da on da."itemTransacaoAgrupadoId"=ita."id"
      left join public.user uu on uu."permitCode"=it."idOperadora"
      where it."dataOrdem" between '${dataIniForm}' and '${dataFimForm}'
      and it."nomeConsorcio" in('STPC','STPL','TEC')
      and ap."isPago"=false
      and uu."fullName" in('${nomes?.join("','")}')
      and exists(select 1 from item_transacao itt 
                          inner join item_transacao_agrupado itta on itt."itemTransacaoAgrupadoId"=itta.id
                          inner join arquivo_publicacao apt on apt."itemTransacaoId"=itt.id
                          inner join detalhe_a dat on dat."itemTransacaoAgrupadoId"=itta."id" 
                          left join public.user uut on uut."permitCode"=itt."idOperadora"
                          where itt."dataOrdem" between '${dataIniForm}' and '${dataFimForm}'
                          and itt."nomeConsorcio" in('STPC','STPL','TEC')
                          and apt."isPago"=true
                          and uut."fullName" in('${nomes?.join("','")}'))

      union all

      --QUERY RETORNA OS SEM REMESSA

      select distinct op."idOrdemPagamento",op."nomeOperadora" nome, op."dataOrdem",op."nomeConsorcio" consorcio,op."valor" 
              from ordem_pagamento op				
              where
              op."nomeOperadora" in('${nomes?.join("','")}')
              op."ordemPagamentoAgrupadoId" is null
              and op."dataCaptura" between '${dataIniForm}' and '${dataFimForm}'
      union all

      --QUERY RETORNA TODOS OS PAGAMENTOS PENDENTES - ESTORNADOS E REJEITADOS QUE A PESSOA TENHA RECEBIDO ALGUM PAGAMENTOS APÓS 2025

      select distinct op."idOrdemPagamento",op."nomeOperadora" nome, op."dataOrdem",op."nomeConsorcio" consorcio,op."valor" 
      from ordem_pagamento op
      inner join ordem_pagamento_agrupado opa on opa.id = op."ordemPagamentoAgrupadoId"
      inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId"
      and oph."dataReferencia" = (select max(opph."dataReferencia") 
                                  from ordem_pagamento opp
                                  inner join ordem_pagamento_agrupado oppa on oppa.id = opp."ordemPagamentoAgrupadoId"
                                  inner join ordem_pagamento_agrupado_historico opph on oppa.id = opph."ordemPagamentoAgrupadoId"
                                  where opph."ordemPagamentoAgrupadoId" =oph."ordemPagamentoAgrupadoId" 
                                  and op."idOrdemPagamento"=opp."idOrdemPagamento" 
                                  and op."dataOrdem"=opp."dataOrdem"
                                  and op."idOperadora"=opp."idOperadora"										  
                                  ) 
      where oph."statusRemessa"= 4 
      and op."dataCaptura" between '${dataIniForm}' and '${dataFimForm}'
      and exists (select 1  from ordem_pagamento opv
                            inner join ordem_pagamento_agrupado opav on opav.id = opv."ordemPagamentoAgrupadoId"
                            inner join ordem_pagamento_agrupado_historico ophv on opav.id = ophv."ordemPagamentoAgrupadoId"
                            where opv."idOperadora"=op."idOperadora" 
                            and ophv."statusRemessa"=3
                  )
      and op."nomeOperadora" in('${nomes?.join("','")}')
      order by "dataOrdem"`;
    const result = await this.ordemPagamentoRepository.query(query);
    return result.map((r: DeepPartial<OrdemPagamentoPendenteDto> | undefined) => {
      new OrdemPagamentoPendenteDto(r);
    });
  }

  public async findOrdemUnica(idOrdemPagamentoAg: number) {
    const query = `SELECT * FROM ordem_pagamento_unico op 
                    where op."idOrdemPagamento"='${idOrdemPagamentoAg}' `;
    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result.map((r: DeepPartial<OrdemPagamentoUnicoDto> | undefined) => new OrdemPagamentoUnicoDto(r))[0];
  }

  public async findCustom(idOrdemPagamentoAg: number) {
    const query = `SELECT * FROM ordem_pagamento_agrupado opa 
                    where opa."id"='${idOrdemPagamentoAg}' `;
    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result.map((r: DeepPartial<OrdemPagamentoAgrupado> | undefined) => new OrdemPagamentoAgrupado(r))[0];
  }
  public async findCustomChild(idOrdemPagamentoAg: number) {
    const query = `SELECT * FROM ordem_pagamento_agrupado opa 
                    where opa."ordemPagamentoAgrupadoId"='${idOrdemPagamentoAg}' 
                    LIMIT 1`;
    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result.map((r: DeepPartial<OrdemPagamentoAgrupado> | undefined) => new OrdemPagamentoAgrupado(r))[0];
  }

  public async agruparOrdensDePagamentoPendentes(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador, idOperadoras?: string[]): Promise<void> {
    const dtInicialStr = dataInicial.toISOString().split('T')[0];
    const dtFinalStr = dataFinal.toISOString().split('T')[0];
    const dtPgtoStr = dataPgto.toISOString().split('T')[0];
    const ipOperadorasJoin = idOperadoras ? idOperadoras.join(',') : '';
    await this.ordemPagamentoRepository.query(`CALL P_AGRUPAR_ORDENS_PENDENTES($1, $2, $3, $4, $5)`, [`${dtInicialStr} 00:00:00`, `${dtFinalStr} 23:59:59`, dtPgtoStr, pagador.id, `{${ipOperadorasJoin}}`]);
  }
  public async agruparOrdensDeEstornadosRejeitados(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador, idOperadoras?: string[]): Promise<void> {
    const dtInicialStr = dataInicial.toISOString().split('T')[0];
    const dtFinalStr = dataFinal.toISOString().split('T')[0];
    const dtPgtoStr = dataPgto.toISOString().split('T')[0];
    const ipOperadorasJoin = idOperadoras ? idOperadoras.join(',') : '';
    await this.ordemPagamentoRepository.query(`CALL P_AGRUPAR_ORDENS_ESTORNOS_REJEITADOS($1, $2, $3, $4, $5)`, [`${dtInicialStr} 00:00:00`, `${dtFinalStr} 23:59:59`, dtPgtoStr, pagador.id, `{${ipOperadorasJoin}}`]);
  }

  public async findOrdensAgrupadas(dataInicio: Date, dataFim: Date, consorcios: string[]) {

    const dtInicialStr = dataInicio.toISOString().split('T')[0];
    const dtFinalStr = dataFim.toISOString().split('T')[0];
    const consorciosJoin = consorcios.join("','");


    const query = `SELECT distinct op."ordemPagamentoAgrupadoId" FROM ordem_pagamento op 
                    where date_trunc('day', op."dataCaptura") between '${dtInicialStr}' and '${dtFinalStr}'  
                    and op."nomeConsorcio" in('${consorciosJoin}') 
                    and op."ordemPagamentoAgrupadoId" is not null `;

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result;
  }

  async removerAgrupamento(consorcios: string[], ids: string) {
    const consorciosJoin = consorcios.join("','");
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      queryRunner.connect();
      const query = ` update ordem_pagamento set "ordemPagamentoAgrupadoId"=null 
                    where "nomeConsorcio" in('${consorciosJoin}') 
                    and "ordemPagamentoAgrupadoId" in('${ids}') `;

      await queryRunner.query(query);
    } finally {
      queryRunner.release();
    }
  }
}
