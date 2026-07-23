import { Injectable } from '@nestjs/common';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { appSettings } from 'src/settings/app.settings';
import { SettingsService } from 'src/settings/settings.service';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { User } from 'src/users/entities/user.entity';
import { UsersRepository } from 'src/users/users.repository';
import { CustomLogger } from 'src/utils/custom-logger';
import { DeepPartial } from 'typeorm';
import { validateEmail } from 'validations-br';
import { parseStringUpperUnaccent } from 'src/utils/string-utils';
import { AgentesBigqueryRepository } from './agentes-bigquery.repository';
import { AgenteBigqueryUser } from './interfaces/agente-bigquery-user.interface';

export interface SyncWeeklyAgentUsersResult {
  processedRows: number;
  createdAgentUsers: number;
  createdAssociationUsers: number;
  queuedInvites: number;
  skippedExistingAgents: number;
  skippedExistingAssociations: number;
}

@Injectable()
export class AgentesSyncService {
  private readonly logger = new CustomLogger(AgentesSyncService.name, {
    timestamp: true,
  });

  constructor(
    private readonly agentesBigqueryRepository: AgentesBigqueryRepository,
    private readonly usersRepository: UsersRepository,
    private readonly mailHistoryService: MailHistoryService,
    private readonly settingsService: SettingsService,
  ) { }

  async syncWeeklyAgentUsers(
    rows?: AgenteBigqueryUser[],
  ): Promise<SyncWeeklyAgentUsersResult> {
    const METHOD = this.syncWeeklyAgentUsers.name;
    const lastExecutionSetting = await this.settingsService.getOneBySettingData(
      appSettings.any__agentes_sync_last_execution,
      true,
      METHOD,
    );
    const sourceRows = rows ?? (await this.agentesBigqueryRepository.findUsersToSync(
      lastExecutionSetting.getValueAsString(),
    ));

    const result: SyncWeeklyAgentUsersResult = {
      processedRows: sourceRows.length,
      createdAgentUsers: 0,
      createdAssociationUsers: 0,
      queuedInvites: 0,
      skippedExistingAgents: 0,
      skippedExistingAssociations: 0,
    };
    let lastProcessedTimestamp: string | null = null;

    for (const row of sourceRows) {
      const association = await this.ensureAssociationUser(row);
      if (association.created) {
        result.createdAssociationUsers += 1;
      } else if (this.normalizeDocument(row.cnpj)) {
        result.skippedExistingAssociations += 1;
      }

      const agent = await this.ensureAgentUser(row);
      if (agent.created) {
        result.createdAgentUsers += 1;
      } else {
        result.skippedExistingAgents += 1;
      }
      if (agent.queuedInvite) {
        result.queuedInvites += 1;
      }

      await this.ensureUserRelationship(agent.user, association.user);
      lastProcessedTimestamp = this.getLatestTimestamp(
        lastProcessedTimestamp,
        row.datetime_ultima_atualizacao,
      );
    }

    if (lastProcessedTimestamp) {
      await this.settingsService.upsertBySettingData(
        appSettings.any__agentes_sync_last_execution,
        lastProcessedTimestamp,
      );
    }

    this.logger.log(`Weekly agent sync finished: ${JSON.stringify(result)}`, METHOD);
    return result;
  }

  private async ensureAssociationUser(
    row: AgenteBigqueryUser,
  ): Promise<{ user: User | null; created: boolean }> {
    const normalizedCnpj = this.normalizeDocument(row.cnpj);
    if (!normalizedCnpj) {
      return { user: null, created: false };
    }

    const existing = await this.findUserByNormalizedDocument(normalizedCnpj);
    if (existing) {
      return { user: existing, created: false };
    }

    return {
      user: await this.usersRepository.create({
      email: this.generateAssociationEmail(),
      provider: 'email',
      fullName: this.normalizeName(row.razao_social),
      firstName: this.getFirstName(row.razao_social),
      lastName: this.getLastName(row.razao_social),
      cpfCnpj: normalizedCnpj,
      role: new Role(RoleEnum.admin),
      permitCode: undefined,
      phone: '5551999999999',
      }),
      created: true,
    };
  }

  private async ensureAgentUser(
    row: AgenteBigqueryUser,
  ): Promise<{ user: User | null; created: boolean; queuedInvite: boolean }> {
    const normalizedDocument = this.normalizeDocument(row.documento);
    if (!normalizedDocument) {
      return { user: null, created: false, queuedInvite: false };
    }

    const existing = await this.findUserByNormalizedDocument(normalizedDocument);
    if (existing) {
      return { user: existing, created: false, queuedInvite: false };
    }

    const { email } = this.resolveAgentEmail(row);
    const hash = email ? await this.mailHistoryService.generateHash() : null;
    const createdUser = await this.usersRepository.create({
      email,
      provider: 'email',
      fullName: this.normalizeName(row.nome),
      firstName: this.getFirstName(row.nome),
      lastName: this.getLastName(row.nome),
      hash,
      role: new Role(RoleEnum.agentes),
      status: new Status(StatusEnum.register),
      permitCode: this.normalizePermitCode(row.numero_identificacao),
      cpfCnpj: normalizedDocument,
      phone: this.normalizePhone(row.telefone),
    } as DeepPartial<User>);

    if (email && hash) {
      await this.mailHistoryService.create(
        {
          user: { id: createdUser.id },
          hash,
          email,
          inviteStatus: {
            id: InviteStatusEnum.queued,
          },
        },
        'AgentesSyncService.syncWeeklyAgentUsers()',
      );
      return { user: createdUser, created: true, queuedInvite: true };
    }

    return { user: createdUser, created: true, queuedInvite: false };
  }

  private async ensureUserRelationship(
    agentUser: User | null,
    associationUser: User | null,
  ): Promise<void> {
    if (!agentUser?.id || !associationUser?.id) {
      return;
    }

    const existingRelationship = await this.usersRepository.findUserRelationship(
      agentUser.id,
      associationUser.id,
    );
    if (existingRelationship) {
      return;
    }

    await this.usersRepository.createUserRelationship(
      agentUser.id,
      associationUser.id,
    );
  }

  private async findUserByNormalizedDocument(
    document: string,
  ): Promise<User | null> {
    const users = await this.usersRepository.findManyByNormalizedCpf(document);
    return users[0] ?? null;
  }

  private normalizeDocument(document?: string | null): string | null {
    const normalized = String(document ?? '').replace(/\D/g, '');
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeEmail(email?: string | null): string | null {
    const normalized = String(email ?? '').trim().toLowerCase();
    return normalized && validateEmail(normalized) ? normalized : null;
  }

  private resolveAgentEmail(
    row: AgenteBigqueryUser,
  ): { email: string; isSynthetic: boolean } {
    const normalizedEmail = this.normalizeEmail(row.email);
    if (normalizedEmail) {
      return { email: normalizedEmail, isSynthetic: false };
    }

    return {
      email: this.generateFallbackAgentEmail(row.nome, row.documento),
      isSynthetic: true,
    };
  }

  private normalizePhone(phone?: string | null): string | undefined {
    const normalized = String(phone ?? '').replace(/\D/g, '');
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizePermitCode(value?: string | null): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeName(name?: string | null): string | null {
    const normalized = String(name ?? '').trim();
    return normalized.length > 0 ? parseStringUpperUnaccent(normalized) : null;
  }

  private getFirstName(name?: string | null): string | null {
    const normalized = this.normalizeName(name);
    if (!normalized) {
      return null;
    }
    return normalized.split(/\s+/)[0] ?? null;
  }

  private getLastName(name?: string | null): string | null {
    const normalized = this.normalizeName(name);
    if (!normalized) {
      return null;
    }
    const parts = normalized.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  private getLatestTimestamp(
    currentTimestamp?: string | null,
    candidateTimestamp?: string | null,
  ): string | null {
    if (!candidateTimestamp) {
      return currentTimestamp ?? null;
    }
    if (!currentTimestamp) {
      return candidateTimestamp;
    }

    return new Date(candidateTimestamp) > new Date(currentTimestamp)
      ? candidateTimestamp
      : currentTimestamp;
  }

  private generateAssociationEmail(): string {
    return `user+${Math.random()}@example.com`;
  }

  private generateFallbackAgentEmail(
    name?: string | null,
    document?: string | null,
  ): string {
    const normalizedDocument = this.normalizeDocument(document) ?? 'documento';
    const firstName = String(this.getFirstName(name) ?? normalizedDocument)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return `${firstName || normalizedDocument}.${normalizedDocument}@example.com`;
  }
}
