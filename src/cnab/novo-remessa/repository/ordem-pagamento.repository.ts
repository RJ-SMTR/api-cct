import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { getStatusRemessaEnumByValue } from '../../enums/novo-remessa/status-remessa.enum';
import { OcorrenciaEnum } from '../../enums/ocorrencia.enum';
import { OrdemPagamentoPendenteDto } from '../dto/ordem-pagamento-pendente.dto';
import { OrdemPagamentoPendenteNuncaRemetidasDto } from '../dto/ordem-pagamento-pendente-nunca-remetidas.dto';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { parseNumber } from '../../utils/cnab/cnab-field-utils';
import { OrdemPagamentoUnicoDto } from '../dto/ordem-pagamento-unico.dto';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { formatDateISODate } from 'src/utils/date-utils';

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
        WITH month_dates AS (SELECT generate_series(
                                            DATE_TRUNC('month', $1::DATE),
                                            DATE_TRUNC('month', $1::DATE) + INTERVAL '1 month' - INTERVAL '1 day',
                                            '1 day'
                                    ) AS data)
        SELECT data,
               (SELECT ROUND("valorTotal", 2)
                FROM ordem_pagamento_agrupado opa
                WHERE 1 = 1
                AND DATE_TRUNC('day', opa."dataPagamento") = data::date
                  AND EXISTS (SELECT 1
                              FROM ordem_pagamento op
                              WHERE op."userId" = $2
                                AND op."dataCaptura" IS NOT NULL
                                AND op."ordemPagamentoAgrupadoId" = opa.id
                    LIMIT 1)
                ORDER BY opa."dataPagamento" DESC
                   LIMIT 1 ) "valorTotal",
               (data::date - 1) data_final_operacoes,
               (data::date - 7) data_inicial_operacoes,
               "dataReferencia",
               "statusRemessa",
               "motivoStatusRemessa",
               "ordemPagamentoAgrupadoId"
        FROM month_dates m
            LEFT JOIN LATERAL (
            SELECT opah."dataReferencia", opah."statusRemessa", opah."motivoStatusRemessa", opah."ordemPagamentoAgrupadoId", opa."dataPagamento"
            FROM ordem_pagamento_agrupado_historico opah
            INNER JOIN ordem_pagamento_agrupado opa
            ON opa.id = opah."ordemPagamentoAgrupadoId"
            INNER JOIN ordem_pagamento op
            ON op."ordemPagamentoAgrupadoId" = opa.id
            WHERE 1 = 1
            AND op."userId" = $2
            AND DATE_TRUNC('day', opa."dataPagamento") = DATE_TRUNC('day', m.data)
            ORDER BY opah."dataReferencia" DESC
            LIMIT 1
            ) opa_aux
        ON DATE_TRUNC('day', opa_aux."dataPagamento") = DATE_TRUNC('day', m.data)
        WHERE EXTRACT (DOW FROM data) = 5
    `;

    const result = await this.ordemPagamentoRepository.query(query, [targetDate, userId]);
    return result.map((row: any) => {
      const dto = new OrdemPagamentoAgrupadoMensalDto();
      dto.data = row.data;
      dto.ordemPagamentoAgrupadoId = row.ordemPagamentoAgrupadoId;
      dto.valorTotal = row.valorTotal != null ? parseFloat(row.valorTotal) : 0;
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

  public async findOrdensPagamentosPendentes(dataInicio: Date, dataFim: Date,nomes:string[]): Promise<OrdemPagamentoPendenteDto[]> {
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
    return result.map((r: DeepPartial<OrdemPagamentoPendenteDto> | undefined) => { new OrdemPagamentoPendenteDto(r);
   });
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

  public async findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    const query = `
        SELECT o.id,
               ROUND(valor, 2) valor,
               date_trunc('day', o."dataCaptura") "dataCaptura"
        FROM ordem_pagamento o
        INNER JOIN ordem_pagamento_agrupado opa
        ON o."ordemPagamentoAgrupadoId" = opa.id
        WHERE 1 = 1
          AND opa.id = $1
          AND o."dataCaptura" IS NOT NULL
          AND o."userId" = $2
        ORDER BY o."dataCaptura" desc
    `;

    let result = await this.ordemPagamentoRepository.query(query, [ordemPagamentoAgrupadoId, userId]);
    result = result.map((row: any) => {
      const ordemPagamento = new OrdemPagamentoSemanalDto();
      ordemPagamento.ordemId = row.id;
      ordemPagamento.dataCaptura = row.dataCaptura;
      ordemPagamento.valor = row.valor ? parseFloat(row.valor) : 0;
      return ordemPagamento;
    });

    const resultGrouped: OrdemPagamentoSemanalDto[] = [];

    for (const row of result) {
      const existing = resultGrouped.find((item) => item.dataCaptura?.toISOString() == row.dataCaptura.toISOString());
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

  public async getOrdensPendentes(dataOrdemInicial: Date, dataOrdemFinal: Date) {
    throw new Error('Method not implemented.');
  }

}