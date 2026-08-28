import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import {
  getStatusRemessaEnumByValue,
  StatusRemessaEnum,
} from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { UserRelationship } from 'src/users/entities/user-relationship.entity';
import { User } from 'src/users/entities/user.entity';
import { DataSource, In, Repository } from 'typeorm';
import { format, getMonth, getYear, isFriday, isTuesday, max, subDays } from 'date-fns';

export type DashboardPhotoEntry = {
  id: string;
  capturedAt: string;
  description: string;
  status: string;
  amount: number;
  rejectionReason: string | null;
};

export type DashboardWorkDay = {
  date: string;
  periodLabel: string;
  pendingReason?: string | null;
  photos: DashboardPhotoEntry[];
};

export type DashboardPaymentCycle = {
  paymentDate: string;
  tentativePaymentDate: string | null;
  effectivePaymentDate: string | null;
  pendingReason?: string | null;
  workDays: DashboardWorkDay[];
};

export type AgentAssociationOption = {
  value: number;
  label: string;
  cpfCnpj: string | null;
};

export type DashboardMonthData = {
  month: string;
  paymentCycles: DashboardPaymentCycle[];
};

export type DashboardDataQuery = {
  month: string;
  userId: number;
  paymentDate?: string;
  workDate?: string;
};

type LegacyGuardadorMonthlyRow = {
  data: string;
  ordemPagamentoAgrupadoIds: string;
  valorTotal: string | number;
  statusRemessa: number | null;
  motivoStatusRemessa: string | null;
  dataTentativaPagamento: string | null;
  dataEfetivaPagamento: string | null;
};

type LegacyGuardadorWeeklyRow = {
  dataCaptura: string;
  valor: string | number;
  ids: number[];
};

type LegacyGuardadorDailyRow = {
  datetime_transacao: string;
  datetime_processamento: string;
  tipo_transacao: string;
  valor_pagamento: string | number;
  dataTentativaPagamento: string | null;
  dataEfetivaPagamento: string | null;
};

type LegacyGuardadorPreviousDaysRow = {
  valor: string | number;
  dataOrdem: string;
  dataCaptura: string;
};

type DashboardMonthlyRow = {
  paymentDate: string;
  dataTentativaPagamento: string | null;
  dataEfetivaPagamento: string | null;
  statusRemessa: number | null;
  motivoStatusRemessa: string | null;
};

type DashboardWeeklyRow = {
  paymentDate: string;
  workDate: string;
  statusRemessa: number | null;
  motivoStatusRemessa: string | null;
};

type DashboardDailyRow = {
  photoId: string;
  paymentDate: string;
  workDate: string;
  description: string;
  amount: string | number;
  statusRemessa: number | null;
  motivoStatusRemessa: string | null;
};

@Injectable()
export class AgentesRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailHistoryService: MailHistoryService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  async findAgentUsers(): Promise<User[]> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.status', 'status')
      .leftJoinAndSelect('user.following', 'following')
      .leftJoinAndSelect('following.relatedUser', 'relatedUser')
      .where('"user"."roleId" = :roleId', { roleId: RoleEnum.agentes })
      .orderBy('"user"."fullName"', 'ASC')
      .getMany();

    await this.loadLazyAuxInvite(users);

    return users;
  }

  async findDashboardData(params: DashboardDataQuery): Promise<DashboardMonthData | null> {
    const [monthlyRows, weeklyRows, dailyRows] = await Promise.all([
      this.dataSource.query(this.buildMonthlyDashboardQuery(), [
        params.month,
        params.userId,
      ]) as Promise<DashboardMonthlyRow[]>,
      this.dataSource.query(this.buildWeeklyDashboardQuery(), [
        params.month,
        params.userId,
        params.paymentDate ?? null,
      ]) as Promise<DashboardWeeklyRow[]>,
      this.dataSource.query(this.buildDailyDashboardQuery(), [
        params.month,
        params.userId,
        params.paymentDate ?? null,
        params.workDate ?? null,
      ]) as Promise<DashboardDailyRow[]>,
    ]);

    if (monthlyRows.length === 0) {
      return null;
    }

    const paymentCyclesMap = new Map<string, DashboardPaymentCycle>();

    for (const row of monthlyRows) {
      paymentCyclesMap.set(row.paymentDate, {
        paymentDate: row.paymentDate,
        tentativePaymentDate: row.dataTentativaPagamento,
        effectivePaymentDate: row.dataEfetivaPagamento,
        pendingReason: this.resolvePendingReason(row.statusRemessa, row.motivoStatusRemessa),
        workDays: [],
      });
    }

    for (const row of weeklyRows) {
      const paymentCycle = this.ensurePaymentCycle(paymentCyclesMap, row.paymentDate, row.statusRemessa, row.motivoStatusRemessa);

      if (paymentCycle.workDays.some((workDay) => workDay.date === row.workDate)) {
        continue;
      }

      paymentCycle.workDays.push({
        date: row.workDate,
        periodLabel: 'Integral',
        pendingReason: this.resolvePendingReason(row.statusRemessa, row.motivoStatusRemessa),
        photos: [],
      });
    }

    for (const row of dailyRows) {
      const paymentCycle = this.ensurePaymentCycle(paymentCyclesMap, row.paymentDate, row.statusRemessa, row.motivoStatusRemessa);
      const workDay = this.ensureWorkDay(paymentCycle, row.workDate, row.statusRemessa, row.motivoStatusRemessa);

      workDay.photos.push({
        id: row.photoId,
        capturedAt: this.toCapturedAt(row.workDate),
        description: row.description,
        status: this.mapStatusRemessaToDashboardStatus(row.statusRemessa),
        amount: Number(row.amount) || 0,
        rejectionReason: this.resolvePhotoRejectionReason(row.statusRemessa, row.motivoStatusRemessa),
      });
    }

    const paymentCycles = [...paymentCyclesMap.values()]
      .map((paymentCycle) => ({
        ...paymentCycle,
        workDays: [...paymentCycle.workDays]
          .map((workDay) => ({
            ...workDay,
            photos: [...workDay.photos].sort((left, right) =>
              right.capturedAt.localeCompare(left.capturedAt),
            ),
          }))
          .sort((left, right) => right.date.localeCompare(left.date)),
      }))
      .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate));

    return {
      month: params.month,
      paymentCycles,
    };
  }

  async getAgentAssociationOptions(userId?: number | string | null): Promise<AgentAssociationOption[]> {
    if (!userId) {
      return [];
    }

    const agentUser = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.following', 'following')
      .leftJoinAndSelect('following.relatedUser', 'relatedUser')
      .where('"user"."id" = :userId', { userId: Number(userId) })
      .getOne();

    return this.getAgentAssociationOptionsFromUser(agentUser ?? null);
  }

  async getAvailableMonths(userId: number): Promise<string[]> {
    const result = await this.dataSource.query(this.buildAvailableMonthsQuery(), [
      userId,
    ]) as Array<{ month: string }>;

    return result.map((row) => row.month);
  }

  getAgentAssociationOptionsFromUser(user?: User | null): AgentAssociationOption[] {
    return this.mapAssociationOptions(user?.following ?? []);
  }

  async findMonthlyByUserId(
    yearMonth: string,
    userId: number,
  ): Promise<LegacyGuardadorMonthlyRow[]> {
    return this.dataSource.query(this.buildLegacyMonthlyQuery(), [yearMonth, userId]);
  }

  async findWeeklyByAgrupadoIds(
    ordemPagamentoAgrupadoIds: string,
    userId: number,
    endDateParam?: Date,
  ): Promise<LegacyGuardadorWeeklyRow[]> {
    const params: any[] = [ordemPagamentoAgrupadoIds, userId];
    let whereData = '';

    if (endDateParam) {
      const today = new Date(endDateParam);
      const isAntesDeSetembro2025 =
        getYear(today) === 2025 && getMonth(today) < 8;
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
      const dataFim = format(today, 'yyyy-MM-dd');

      whereData = `AND date_trunc('day', o."dataOrdem") BETWEEN $3::date AND $4::date
      GROUP BY o.id,  o."dataOrdem", o."dataInclusao"`;
      params.push(dataInicio, dataFim);
    }

    const query = `
    SELECT
          o.id,
           MAX(ROUND(COALESCE(o."valorRepasseGuardador", 0), 2)) as valor,
            date_trunc('day', o."dataInclusao") "dataCaptura",
           o."dataOrdem"
    FROM ordem_pagamento_guardador o
    INNER JOIN ordem_pagamento_agrupado opa
    ON o."ordemPagamentoAgrupadoId" = opa.id
    WHERE 1 = 1
      AND opa.id = ANY(string_to_array($1, ',')::int[])
      AND o."dataInclusao" IS NOT NULL
      AND o."userId" = $2
      ${whereData}
    ORDER BY o."dataInclusao" DESC `;

    let result = await this.dataSource.query(query, params);

    result = result.map((row: any) => ({
      ordemId: row.id,
      dataCaptura: row.dataCaptura,
      valor: row.valor ? parseFloat(row.valor) : 0,
    }));

    const resultGrouped: Array<{ ordemId?: number; dataCaptura?: Date; valor: number; ids?: number[] }> = [];

    for (const row of result) {
      const existing = resultGrouped.find(
        (item) => item.dataCaptura?.toISOString() === row.dataCaptura?.toISOString(),
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

    return resultGrouped.map((row) => ({
      dataCaptura: row.dataCaptura ? row.dataCaptura.toISOString() : '',
      valor: row.valor,
      ids: row.ids || [],
    }));
  }

  async findDailyByOrdemIds(
    ordemPagamentoIds: string,
    userId: number,
  ): Promise<LegacyGuardadorDailyRow[]> {
    return this.dataSource.query(this.buildLegacyDailyQuery(), [
      ordemPagamentoIds,
      userId,
    ]);
  }

  async findPreviousDaysByAgrupadoIds(
    ordemPagamentoAgrupadoIds: string,
    userId: number,
  ): Promise<LegacyGuardadorPreviousDaysRow[]> {
    return this.dataSource.query(this.buildLegacyPreviousDaysQuery(), [
      ordemPagamentoAgrupadoIds,
      userId,
    ]);
  }

  private mapAssociationOptions(relationships: UserRelationship[]): AgentAssociationOption[] {
    const associations = relationships
      .map((relationship) => relationship.relatedUser)
      .filter((relatedUser): relatedUser is User => Boolean(relatedUser?.id));

    const seen = new Set<number>();

    return associations
      .filter((association) => {
        if (seen.has(association.id)) {
          return false;
        }
        seen.add(association.id);
        return true;
      })
      .map((association) => ({
        value: association.id,
        label:
          association.fullName?.trim() ||
          association.cpfCnpj?.trim() ||
          `Associacao #${association.id}`,
        cpfCnpj: association.cpfCnpj ?? null,
      }));
  }

  private ensurePaymentCycle(
    paymentCyclesMap: Map<string, DashboardPaymentCycle>,
    paymentDate: string,
    statusRemessa: number | null,
    motivoStatusRemessa: string | null,
  ) {
    const existing = paymentCyclesMap.get(paymentDate);

    if (existing) {
      return existing;
    }

    const paymentCycle: DashboardPaymentCycle = {
      paymentDate,
      tentativePaymentDate: null,
      effectivePaymentDate: null,
      pendingReason: this.resolvePendingReason(statusRemessa, motivoStatusRemessa),
      workDays: [],
    };

    paymentCyclesMap.set(paymentDate, paymentCycle);

    return paymentCycle;
  }

  private ensureWorkDay(
    paymentCycle: DashboardPaymentCycle,
    workDate: string,
    statusRemessa: number | null,
    motivoStatusRemessa: string | null,
  ) {
    const existing = paymentCycle.workDays.find((workDay) => workDay.date === workDate);

    if (existing) {
      return existing;
    }

    const workDay: DashboardWorkDay = {
      date: workDate,
      periodLabel: 'Integral',
      pendingReason: this.resolvePendingReason(statusRemessa, motivoStatusRemessa),
      photos: [],
    };

    paymentCycle.workDays.push(workDay);

    return workDay;
  }

  private mapStatusRemessaToDashboardStatus(statusRemessa: number | null) {
    if (Number(statusRemessa) === StatusRemessaEnum.Efetivado) {
      return 'Pago';
    }

    if (Number(statusRemessa) === StatusRemessaEnum.AguardandoPagamento) {
      return 'Aguardando Pagamento';
    }

    return 'Rejeitado';
  }

  private resolvePhotoRejectionReason(
    statusRemessa: number | null,
    motivoStatusRemessa: string | null,
  ) {
    if (
      Number(statusRemessa) === StatusRemessaEnum.Efetivado ||
      Number(statusRemessa) === StatusRemessaEnum.AguardandoPagamento
    ) {
      return null;
    }

    return this.resolvePendingReason(statusRemessa, motivoStatusRemessa);
  }

  private resolvePendingReason(
    statusRemessa: number | null,
    motivoStatusRemessa: string | null,
  ) {
    if (Number(statusRemessa) === StatusRemessaEnum.Efetivado) {
      return null;
    }

    if (motivoStatusRemessa) {
      return OcorrenciaEnum[motivoStatusRemessa as keyof typeof OcorrenciaEnum] ?? motivoStatusRemessa;
    }

    if (statusRemessa == null) {
      return null;
    }

    if (Number(statusRemessa) === StatusRemessaEnum.AguardandoPagamento) {
      return 'Aguardando Pagamento';
    }

    return getStatusRemessaEnumByValue(statusRemessa as StatusRemessaEnum) ?? null;
  }

  private toCapturedAt(workDate: string) {
    return `${workDate}T12:00:00.000Z`;
  }

  private buildLegacyMonthlyQuery() {
    return `
    WITH
    efetivacao_por_agrupado AS (
      SELECT
        oph."ordemPagamentoAgrupadoId",
        MAX(da."dataVencimento") AS data_efetiva
      FROM ordem_pagamento_agrupado_historico oph
      INNER JOIN detalhe_a da
        ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
      GROUP BY oph."ordemPagamentoAgrupadoId"
    ),

    datas_base AS (
      SELECT
        data::date AS data_referencia,
        EXTRACT(dow FROM data) AS dia_semana
      FROM generate_series(
        DATE_TRUNC('month', $1::DATE),
        DATE_TRUNC('month', $1::DATE) + INTERVAL '1 month' - INTERVAL '1 day',
        '1 day'::INTERVAL
      ) AS data
      WHERE (
        (
          $1::date <= DATE '2025-12-31'
          AND EXTRACT(dow FROM data) = 5
        )
        OR (
          $1::date > DATE '2025-12-31'
          AND EXTRACT(dow FROM data) IN (2, 5)
        )
        OR (
          DATE_TRUNC('month', $1::date) = DATE '2026-07-01'
          AND data::date = DATE '2026-07-23'
        )
      )
    ),

    ordens_por_data AS (
      SELECT DISTINCT
        db.data_referencia,

        -- Identifica individualmente cada ordem de guardador
        op.id AS "ordemGuardadorId",

        op."dataOrdem",

        COALESCE(
          da."dataEfetivacao",
          efetivacao_por_agrupado.data_efetiva
        ) AS data_efetiva,

        ROUND(
          op."valorRepasseGuardador"::numeric,
          2
        ) AS valorTotalPagamento,

        oph."statusRemessa",
        oph."motivoStatusRemessa",

        opa.id AS opaId

      FROM datas_base db

      LEFT JOIN ordem_pagamento_guardador op
        ON op."userId" = $2
        AND DATE_TRUNC('day', op."dataOrdem") = db.data_referencia

      LEFT JOIN ordem_pagamento_agrupado opa
        ON op."ordemPagamentoAgrupadoId" = opa.id

      LEFT JOIN efetivacao_por_agrupado
        ON efetivacao_por_agrupado."ordemPagamentoAgrupadoId" = opa.id

      LEFT JOIN LATERAL (
        SELECT
          oph_i.id,
          oph_i."statusRemessa",
          oph_i."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph_i
        WHERE oph_i."ordemPagamentoAgrupadoId" = opa.id
        ORDER BY
          oph_i."dataReferencia" DESC,
          oph_i.id DESC
        LIMIT 1
      ) oph ON TRUE

      LEFT JOIN detalhe_a da
        ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    ),

    status_5_mais_recente AS (
      SELECT
        opd.*,
        ROW_NUMBER() OVER (
          PARTITION BY opd."ordemGuardadorId"
          ORDER BY opd.data_referencia DESC
        ) AS rn
      FROM ordens_por_data opd
      WHERE opd."statusRemessa" = 5
    ),

    ordens_filtradas AS (
      SELECT
        opd."ordemGuardadorId",
        opd.data_referencia,
        opd.data_efetiva,
        opd."dataOrdem",
        opd.valorTotalPagamento,
        opd."statusRemessa",
        opd."motivoStatusRemessa",
        opd.opaId
      FROM ordens_por_data opd
      WHERE COALESCE(opd."statusRemessa", -1) <> 5

      UNION ALL

      SELECT
        s5."ordemGuardadorId",
        s5.data_referencia,
        s5.data_efetiva,
        s5."dataOrdem",
        s5.valorTotalPagamento,
        s5."statusRemessa",
        s5."motivoStatusRemessa",
        s5.opaId
      FROM status_5_mais_recente s5
      WHERE s5.rn = 1
    )

    SELECT
      r.data_referencia AS data,
      r."dataOrdem",
      r.data_efetiva AS "dataEfetivaPagamento",
      r."statusRemessa",
      r."motivoStatusRemessa",
      STRING_AGG(
        DISTINCT r.opaId::text,
        ', '
      ) AS "ordemPagamentoAgrupadoIds",
      r.valorTotalPagamento AS "valorTotal"

    FROM ordens_filtradas r

    GROUP BY
      r."ordemGuardadorId",
      r.data_referencia,
      r."dataOrdem",
      r."statusRemessa",
      r.valorTotalPagamento,
      r."motivoStatusRemessa",
      r.data_efetiva

    ORDER BY r.data_referencia DESC;
  `;
  }

  private buildLegacyDailyQuery() {
    return `
      WITH efetivacao_por_agrupado AS (
        SELECT
          oph."ordemPagamentoAgrupadoId",
          MAX(da."dataEfetivacao") AS "dataEfetivaPagamento"
        FROM ordem_pagamento_agrupado_historico oph
        INNER JOIN detalhe_a da
          ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        GROUP BY oph."ordemPagamentoAgrupadoId"
      )
      SELECT
        TO_CHAR(DATE_TRUNC('day', opg."dataInclusao"), 'YYYY-MM-DD') || 'T12:00:00.000Z' AS datetime_transacao,
        TO_CHAR(DATE_TRUNC('day', opg."dataOrdem"), 'YYYY-MM-DD') || 'T12:00:00.000Z' AS datetime_processamento,
        COALESCE(NULLIF(TRIM(opg."tipoOrdemPagamento"), ''), 'Integral') AS tipo_transacao,
        ROUND(COALESCE(opg."valorRepasseGuardador", 0)::numeric, 2) AS valor_pagamento,
        TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "dataTentativaPagamento",
        TO_CHAR(efetivacao_por_agrupado."dataEfetivaPagamento", 'YYYY-MM-DD') AS "dataEfetivaPagamento"
      FROM ordem_pagamento_guardador opg
      INNER JOIN ordem_pagamento_agrupado opa
        ON opa.id = opg."ordemPagamentoAgrupadoId"
      LEFT JOIN efetivacao_por_agrupado
        ON efetivacao_por_agrupado."ordemPagamentoAgrupadoId" = opa.id
      WHERE opg.id = ANY(string_to_array($1, ',')::int[])
        AND opg."userId" = $2
      ORDER BY opg."dataInclusao" DESC, opg.id DESC
    `;
  }

  private buildLegacyPreviousDaysQuery() {
    return `
      SELECT SUM(ROUND(COALESCE(op."valorRepasseGuardador", 0), 2)) valor,
             op."dataOrdem",
             op."dataInclusao" as "dataCaptura"
      FROM ordem_pagamento_guardador op
      INNER JOIN ordem_pagamento_agrupado opa
      ON op."ordemPagamentoAgrupadoId" = opa.id
      WHERE 1 = 1
        AND opa.id = ANY(string_to_array($1, ',')::int[])
        AND op."dataInclusao" IS NOT NULL
        AND op."userId" = $2
        AND date_trunc('day', op."dataOrdem") < date_trunc('day', "dataPagamento") - INTERVAL '7 days'
      GROUP BY op."dataOrdem", op."dataInclusao"
      ORDER BY op."dataOrdem" desc
    `;
  }

  private buildAvailableMonthsQuery() {
    return `
      SELECT DISTINCT
        TO_CHAR(opa."dataPagamento", 'YYYY-MM') AS month
      FROM ordem_pagamento_guardador opg
      INNER JOIN ordem_pagamento_agrupado opa
        ON opa.id = opg."ordemPagamentoAgrupadoId"
      WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
        AND opg."userId" = $1
      ORDER BY month DESC
    `;
  }

  private buildMonthlyDashboardQuery() {
    return `
      WITH latest_history AS (
        SELECT DISTINCT ON (oph."ordemPagamentoAgrupadoId")
          oph.id,
          oph."ordemPagamentoAgrupadoId",
          oph."dataReferencia",
          oph."statusRemessa",
          oph."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph
        ORDER BY oph."ordemPagamentoAgrupadoId", oph."dataReferencia" DESC, oph.id DESC
      ),
      latest_effective_payment AS (
        SELECT
          latest_history."ordemPagamentoAgrupadoId",
          MAX(da."dataEfetivacao") AS "dataEfetivaPagamento"
        FROM latest_history
        INNER JOIN detalhe_a da
          ON da."ordemPagamentoAgrupadoHistoricoId" = latest_history.id
        GROUP BY latest_history."ordemPagamentoAgrupadoId"
      )
      SELECT
        TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
        TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "dataTentativaPagamento",
        TO_CHAR(latest_effective_payment."dataEfetivaPagamento", 'YYYY-MM-DD') AS "dataEfetivaPagamento",
        latest_history."statusRemessa" AS "statusRemessa",
        latest_history."motivoStatusRemessa" AS "motivoStatusRemessa"
      FROM ordem_pagamento_guardador opg
      INNER JOIN ordem_pagamento_agrupado opa
        ON opa.id = opg."ordemPagamentoAgrupadoId"
      LEFT JOIN latest_history
        ON latest_history."ordemPagamentoAgrupadoId" = opa.id
      LEFT JOIN latest_effective_payment
        ON latest_effective_payment."ordemPagamentoAgrupadoId" = opa.id
      WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
        AND TO_CHAR(opa."dataPagamento", 'YYYY-MM') = $1
        AND opg."userId" = $2
      GROUP BY
        opa."dataPagamento",
        latest_effective_payment."dataEfetivaPagamento",
        latest_history."statusRemessa",
        latest_history."motivoStatusRemessa"
      ORDER BY opa."dataPagamento" DESC
    `;
  }

  private buildWeeklyDashboardQuery() {
    return `
      WITH latest_history AS (
        SELECT DISTINCT ON (oph."ordemPagamentoAgrupadoId")
          oph."ordemPagamentoAgrupadoId",
          oph."dataReferencia",
          oph."statusRemessa",
          oph."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph
        ORDER BY oph."ordemPagamentoAgrupadoId", oph."dataReferencia" DESC, oph.id DESC
      )
      SELECT
        TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
        TO_CHAR(opg."dataInclusao", 'YYYY-MM-DD') AS "workDate",
        latest_history."statusRemessa" AS "statusRemessa",
        latest_history."motivoStatusRemessa" AS "motivoStatusRemessa"
      FROM ordem_pagamento_guardador opg
      INNER JOIN ordem_pagamento_agrupado opa
        ON opa.id = opg."ordemPagamentoAgrupadoId"
      LEFT JOIN latest_history
        ON latest_history."ordemPagamentoAgrupadoId" = opa.id
      WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
        AND TO_CHAR(opa."dataPagamento", 'YYYY-MM') = $1
        AND opg."userId" = $2
        AND ($3::date IS NULL OR opa."dataPagamento" = $3::date)
      GROUP BY
        opa."dataPagamento",
        opg."dataInclusao",
        latest_history."statusRemessa",
        latest_history."motivoStatusRemessa"
      ORDER BY opa."dataPagamento" DESC, opg."dataInclusao" DESC
    `;
  }

  private buildDailyDashboardQuery() {
    return `
      WITH latest_history AS (
        SELECT DISTINCT ON (oph."ordemPagamentoAgrupadoId")
          oph."ordemPagamentoAgrupadoId",
          oph."dataReferencia",
          oph."statusRemessa",
          oph."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph
        ORDER BY oph."ordemPagamentoAgrupadoId", oph."dataReferencia" DESC, oph.id DESC
      )
      SELECT
        COALESCE(NULLIF(TRIM(opg."idOrdemPagamento"), ''), CONCAT('GUARDADOR-', opg.id::text)) AS "photoId",
        TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
        TO_CHAR(opg."dataInclusao", 'YYYY-MM-DD') AS "workDate",
        CONCAT(
          COALESCE(NULLIF(TRIM(opg."tipoOrdemPagamento"), ''), 'Repasse do guardador'),
          COALESCE(CONCAT(' #', NULLIF(TRIM(opg."idOrdemPagamento"), '')), '')
        ) AS description,
        ROUND(COALESCE(opg."valorRepasseGuardador", 0)::numeric, 2) AS amount,
        latest_history."statusRemessa" AS "statusRemessa",
        latest_history."motivoStatusRemessa" AS "motivoStatusRemessa"
      FROM ordem_pagamento_guardador opg
      INNER JOIN ordem_pagamento_agrupado opa
        ON opa.id = opg."ordemPagamentoAgrupadoId"
      LEFT JOIN latest_history
        ON latest_history."ordemPagamentoAgrupadoId" = opa.id
      WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
        AND TO_CHAR(opa."dataPagamento", 'YYYY-MM') = $1
        AND opg."userId" = $2
        AND ($3::date IS NULL OR opa."dataPagamento" = $3::date)
        AND ($4::date IS NULL OR opg."dataInclusao" = $4::date)
      ORDER BY opa."dataPagamento" DESC, opg."dataInclusao" DESC, opg.id DESC
    `;
  }

  private async loadLazyAuxInvite(users: User[]) {
    if (users.length === 0) {
      return;
    }

    const mails = await this.mailHistoryService.find({
      user: { id: In(users.map((user) => user.id)) },
    });

    for (const user of users) {
      const mailHistories = mails.filter((mail) => mail.user.id === user.id);
      const mailHistory = mailHistories[0] as MailHistory | undefined;
      user.mailHistories = mailHistories;
      const hasBankAccount =
        user.bankCode !== null &&
        user.bankCode !== undefined &&
        Boolean(user.bankAgency) &&
        Boolean(user.bankAccount) &&
        Boolean(user.bankAccountDigit);

      user.aux_inviteStatus =
        user.role?.id === RoleEnum.agentes && hasBankAccount && !user.password
          ? new InviteStatus(InviteStatusEnum.prov)
          : mailHistory?.inviteStatus;
      user.inviteAt = mailHistory?.sentAt ?? null;
      user.aux_inviteHash = mailHistory?.hash;
    }
  }
}
