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

type DashboardMonthlyRow = {
  paymentDate: string;
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
          oph."ordemPagamentoAgrupadoId",
          oph."statusRemessa",
          oph."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph
        ORDER BY oph."ordemPagamentoAgrupadoId", oph.id DESC
      )
      SELECT
        TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
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
      GROUP BY
        opa."dataPagamento",
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
          oph."statusRemessa",
          oph."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph
        ORDER BY oph."ordemPagamentoAgrupadoId", oph.id DESC
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
          oph."statusRemessa",
          oph."motivoStatusRemessa"
        FROM ordem_pagamento_agrupado_historico oph
        ORDER BY oph."ordemPagamentoAgrupadoId", oph.id DESC
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
