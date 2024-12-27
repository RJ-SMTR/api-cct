import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdensPagamentoAgrupadasDto } from '../dto/ordens-pagamento-agrupadas.dto';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';
import { OrdemPagamentoDiarioDto } from '../dto/ordem-pagamento-diario.dto';
import { getStatusRemessaEnumByValue } from '../../enums/novo-remessa/status-remessa.enum';

@Injectable()
export class OrdemPagamentoRepository {
  private logger = new CustomLogger(OrdemPagamentoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamento)
    private ordemPagamentoRepository: Repository<OrdemPagamento>,
  ) {}

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
               (SELECT SUM(valor)
                FROM ordem_pagamento o
                WHERE 1 = 1
                  AND DATE_TRUNC('day', o."dataOrdem") <= (data::date - 1)
                  AND DATE_TRUNC('day', o."dataOrdem") >= (data::date - 7)
                  AND o."userId" = $2
                  AND o."dataCaptura" IS NOT NULL),
               (data::date - 1) data_final_operacoes,
               (data::date - 7) data_inicial_operacoes,
               "dataReferencia",
               "statusRemessa",
               "motivoStatusRemessa",
               "ordemPagamentoAgrupadoId"
        FROM month_dates m
        LEFT JOIN LATERAL (
            SELECT opah."dataReferencia",
                   opah."statusRemessa",
                   opah."motivoStatusRemessa",
                   opah."ordemPagamentoAgrupadoId",
                   opa."dataPagamento"
            FROM ordem_pagamento_agrupado_historico opah
                     INNER JOIN ordem_pagamento_agrupado opa
                                ON opa.id = opah."ordemPagamentoAgrupadoId"
                     INNER JOIN ordem_pagamento op
                                ON opah."ordemPagamentoAgrupadoId" = opa.id
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
      dto.valorTotal = parseFloat(parseFloat(row.sum)?.toFixed(2));
      if (row.motivoStatusRemessa != null){
        dto.motivoStatusRemessa = row.motivoStatusRemessa;
        dto.descricaoStatusRemessa = getStatusRemessaEnumByValue(row.statusRemessa);
      }
      if (row.statusRemessa != null) {
        dto.statusRemessa =row.statusRemessa;
        dto.descricaoStatusRemessa = getStatusRemessaEnumByValue(row.statusRemessa);
      }
      return dto;
    });
  }

  public async findOrdensPagamento(userId: number, targetDate: Date): Promise<OrdemPagamentoDiarioDto[]> {
    const query = `
        SELECT valor,
               o."dataOrdem",
               opah_aux."dataReferencia",
               opah_aux."statusRemessa",
               opah_aux."motivoStatusRemessa"
        FROM ordem_pagamento o
        LEFT JOIN ordem_pagamento_agrupado opa
        ON o."ordemPagamentoAgrupadoId" = opa.id
        LEFT JOIN LATERAL (
            SELECT MAX("dataReferencia") "dataReferencia",
                   "statusRemessa",
                   "motivoStatusRemessa",
                   "ordemPagamentoAgrupadoId"
            FROM ordem_pagamento_agrupado_historico opah
            WHERE opah."ordemPagamentoAgrupadoId" = opa.id
            GROUP BY "statusRemessa",
                     "motivoStatusRemessa",
                     "ordemPagamentoAgrupadoId"
                ) opah_aux
        ON opah_aux."ordemPagamentoAgrupadoId" = opa.id
        WHERE 1 = 1
          AND DATE_TRUNC('day', o."dataOrdem") <= ('2024-12-20'::date - 1)
          AND DATE_TRUNC('day', o."dataOrdem") >= ('2024-12-20'::date - 7)
          AND o."userId" = 1
          AND o."dataCaptura" IS NOT NULL
        ORDER BY o."dataOrdem"
    `;

    const result = await this.ordemPagamentoRepository.query(query, [targetDate, userId]);
    return result.map((row: any) => {
      return new OrdemPagamentoDiarioDto(row);
    });
  }

  public async findOrdensPagamentoAgrupadas(fields: EntityCondition<OrdemPagamento>): Promise<OrdensPagamentoAgrupadasDto[]> {
    const groupedData = await this.ordemPagamentoRepository
      .createQueryBuilder('ordemPagamento')
      .select([
        'ordemPagamento.userId',
        'ordemPagamento.idOperadora',
        'SUM(ordemPagamento.valor) as valorTotal',
        `JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', ordemPagamento.id,
          'dataOrdem', ordemPagamento.dataOrdem,
          'valor', "ordemPagamento".valor
        )
      ) as ordensPagamento`,
      ])
      .where(fields)
      .groupBy('ordemPagamento.userId')
      .addGroupBy('ordemPagamento.idOperadora') // Order by the less recent within the group
      .getRawMany();

    const result: OrdensPagamentoAgrupadasDto[] = groupedData.map((item) => {
      return {
        userId: item.ordemPagamento_userId,
        idOperadora: item.ordemPagamento_idOperadora,
        valorTotal: item.valortotal,
        ordensPagamento: item.ordenspagamento.map((op: any) => {
          if (op) {
            const ordemPagamento = new OrdemPagamento();
            ordemPagamento.id = op.id;
            ordemPagamento.valor = op.valor.toFixed(2);
            return ordemPagamento;
          }
        }), // Parse JSON array into OrdemPagamento objects
      };
    });

    return result;
  }
}
