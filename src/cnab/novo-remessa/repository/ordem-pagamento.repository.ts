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

@Injectable()
export class OrdemPagamentoRepository {
  getOrdensPendentes(dataOrdemInicial: Date, dataOrdemFinal: Date) {
    throw new Error('Method not implemented.');
  }
 
  
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

  /***
   * Obtém as ordens que foram agrupadas mas o pagamento falhou.
   * Existem dois tipos de falhas:
   * - Falhas nas quais o usuário deve modificar os dados bancários.
   * - Falhas nas quais houve um erro desconhecido no arquivo de retorno do banco
   * Não são retornadas ordens que o usuário não modificou os dados bancários caso houveram os erros referentes a conta
   * do usuário.
   * @returns OrdemPagamentoPendenteDto[] - Lista de ordens de pagamento pendentes
   *  */
  public async findOrdensPagamentosPendentes(): Promise<OrdemPagamentoPendenteDto[]> {
    const query = `select o.id,
                       o."valor",
                       "dataPagamento",
                       "dataReferencia",
                       "statusRemessa",
                       "motivoStatusRemessa",
                       opa.id as "ordemPagamentoAgrupadoId",
                       "userId"
                from ordem_pagamento o
                         inner join ordem_pagamento_agrupado opa
                                    on o."ordemPagamentoAgrupadoId" = opa.id
                         inner join lateral (
                                select "dataReferencia",
                                       "statusRemessa",
                                       "motivoStatusRemessa",
                                       "ordemPagamentoAgrupadoId",
                                       "userBankCode",
                                       "userBankAgency",
                                       "userBankAccount",
                                       "userBankAccountDigit"
                                from ordem_pagamento_agrupado_historico oph
                                where opa.id = oph."ordemPagamentoAgrupadoId"
                                order by oph."dataReferencia" desc
                                limit 1
                         ) oph
                        on opa.id = oph."ordemPagamentoAgrupadoId"
                         inner join "user" u
                                    on o."userId" = u.id
                where "statusRemessa" = 4
                  and "motivoStatusRemessa" NOT IN ('00', 'BD')
                  and o."userId" is not null
                  and u."bankAccount" is not null
                  and u."bankAgency" is not null
                  and u."bankCode" is not null
                  and u."bankAccountDigit" is not null
                  and (
                    (
                        "motivoStatusRemessa" NOT IN ('AG', 'AM', 'AN', 'AZ', 'BA', '02')
                    )
                        or (
                        "motivoStatusRemessa" IN ('AG', 'AM', 'AN', 'AZ', 'BA', '02')
                            and u."bankAccount" <> oph."userBankAccount"
                            and u."bankAgency" <> oph."userBankAgency"
                            and u."bankCode" <> cast(oph."userBankCode" as integer)
                            and u."bankAccountDigit" <> oph."userBankAccountDigit"
                        )
                    )`;
    const result = await this.ordemPagamentoRepository.query(query);
    return result.map((row: any) => {
      const ordemPagamentoPendente = new OrdemPagamentoPendenteDto();
      ordemPagamentoPendente.id = row.id;
      ordemPagamentoPendente.valor = row.valoe ? parseFloat(row.valor) : 0;
      ordemPagamentoPendente.dataPagamento = row.dataPagamento;
      ordemPagamentoPendente.dataReferencia = row.dataReferencia;
      ordemPagamentoPendente.statusRemessa = row.statusRemessa;
      ordemPagamentoPendente.motivoStatusRemessa = row.motivoStatusRemessa;
      ordemPagamentoPendente.ordemPagamentoAgrupadoId = row.ordemPagamentoAgrupadoId;
      ordemPagamentoPendente.userId = row.userId;
    });
  }

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

}