import { Injectable } from '@nestjs/common';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
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
  ) { }

  async syncWeeklyAgentUsers(
    rows?: AgenteBigqueryUser[],
  ): Promise<SyncWeeklyAgentUsersResult> {
    const METHOD = this.syncWeeklyAgentUsers.name;
    const sourceRows = rows ?? (await this.agentesBigqueryRepository.findUsersToSync());

    const result: SyncWeeklyAgentUsersResult = {
      processedRows: sourceRows.length,
      createdAgentUsers: 0,
      createdAssociationUsers: 0,
      queuedInvites: 0,
      skippedExistingAgents: 0,
      skippedExistingAssociations: 0,
    };

    for (const row of sourceRows) {
      const associationCreated = await this.ensureAssociationUser(row);
      if (associationCreated) {
        result.createdAssociationUsers += 1;
      } else if (this.normalizeDocument(row.cnpj)) {
        result.skippedExistingAssociations += 1;
      }

      const personCreated = await this.ensureAgentUser(row);
      if (personCreated.createdUser) {
        result.createdAgentUsers += 1;
      } else {
        result.skippedExistingAgents += 1;
      }
      if (personCreated.queuedInvite) {
        result.queuedInvites += 1;
      }
    }

    this.logger.log(`Weekly agent sync finished: ${JSON.stringify(result)}`, METHOD);
    return result;
  }

  private async ensureAssociationUser(
    row: AgenteBigqueryUser,
  ): Promise<User | null> {
    const normalizedCnpj = this.normalizeDocument(row.cnpj);
    if (!normalizedCnpj) {
      return null;
    }

    const existing = await this.findUserByNormalizedDocument(normalizedCnpj);
    if (existing) {
      return null;
    }

    return this.usersRepository.create({
      email: this.generateAssociationEmail(),
      provider: 'email',
      fullName: this.normalizeName(row.razao_social),
      firstName: this.getFirstName(row.razao_social),
      lastName: this.getLastName(row.razao_social),
      cpfCnpj: normalizedCnpj,
      role: new Role(RoleEnum.admin),
      permitCode: undefined,
      phone: '5551999999999',
    });
  }

  private async ensureAgentUser(
    row: AgenteBigqueryUser,
  ): Promise<{ createdUser: User | null; queuedInvite: boolean }> {
    const normalizedDocument = this.normalizeDocument(row.documento);
    if (!normalizedDocument) {
      return { createdUser: null, queuedInvite: false };
    }

    const existing = await this.findUserByNormalizedDocument(normalizedDocument);
    if (existing) {
      return { createdUser: null, queuedInvite: false };
    }

    const email = this.normalizeEmail(row.email);
    const hash = email ? await this.mailHistoryService.generateHash() : null;
    const createdUser = await this.usersRepository.create({
      email,
      provider: 'email',
      fullName: this.normalizeName(row.nome),
      firstName: this.getFirstName(row.nome),
      lastName: this.getLastName(row.nome),
      hash,
      role: new Role(RoleEnum.agents),
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
      return { createdUser, queuedInvite: true };
    }

    return { createdUser, queuedInvite: false };
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

  private generateAssociationEmail(): string {
    return `user+${Math.random()}@example.com`;
  }
}
