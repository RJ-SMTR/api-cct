import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AgentesSyncService } from 'src/agentes/agentes-sync.service';
import { AgenteBigqueryUser } from 'src/agentes/interfaces/agente-bigquery-user.interface';
import { subDays } from 'date-fns';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { UsersService } from 'src/users/users.service';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { In } from 'typeorm/find-options/operator/In';

@Injectable()
export class TestService {
  constructor(
    private readonly cronjobsService: CronJobsService,
    private readonly mailHistoryService: MailHistoryService,
    private readonly usersService: UsersService,
    private readonly agentesSyncService: AgentesSyncService,
  ) {}

  async getCronJobsBulkSendInvites() {
    await this.cronjobsService.bulkSendInvites();
  }

  async getCronJobsBulkResendInvites() {
    await this.setMailsToTestResendInvites();
    const result = await this.cronjobsService.bulkResendInvites();
    if (result !== HttpStatus.OK) {
      throw new HttpException('CronJob failed', result);
    }
  }

  private async setMailsToTestResendInvites() {
    const testMails =
      (await this.mailHistoryService.find({
        email: In([
          'sent.user@example.com',
          'used.user@example.com',
          'registered.user@example.com',
        ]),
      })) || [];
    const testSent15 = await this.mailHistoryService.getOne({
      email: 'sent15.user@example.com',
    });

    const now = new Date();
    for (const mail of testMails) {
      await this.mailHistoryService.update(mail.id, {
        sentAt: now,
      });
    }
    await this.mailHistoryService.update(testSent15.id, {
      sentAt: subDays(now, 16),
    });
  }

  async getResetTestingUsers() {
    const queuedMailName = 'queued.user@example.com';
    const queuedMail = await this.mailHistoryService.getOne({
      email: queuedMailName,
    });
    await this.mailHistoryService.update(queuedMail.id, {
      sentAt: null,
      inviteStatus: new InviteStatus(InviteStatusEnum.queued),
    });
  }

  async getInvaidCPFs(filter: {
    name?: string;
    email?: string;
    cpfCnpj?: string;
  }) {
    const common = await this.usersService.findMany({
      where: {
        ...(filter?.name ? { fullName: In(filter.name.split(',')) } : {}),
        ...(filter?.email ? { email: In(filter.email.split(',')) } : {}),
        ...(filter?.cpfCnpj ? { cpfCnpj: In(filter.cpfCnpj.split(',')) } : {}),
        role: { id: RoleEnum.user },
      },
    });
    const invalidCpfs = common.filter((i) => !isCpfOrCnpj(i?.cpfCnpj));
    const validCpfs = common.filter((i) => isCpfOrCnpj(i?.cpfCnpj));
    return {
      commonLength: common.length,
      validCount: validCpfs.length,
      invalidCount: invalidCpfs.length,
      valid: validCpfs.map((i) => ({
        cpfCnpj: i?.cpfCnpj,
        tipoDocumento: isCpfOrCnpj(i?.cpfCnpj),
      })),
      invalid: invalidCpfs.map((i) => ({
        nome: i.fullName,
        telefone: i.phone,
        cpfCnpj: i.cpfCnpj,
      })),
    };
  }

  async syncMockedAgentUsers() {
    const mockRows: AgenteBigqueryUser[] = [
      {
        numero_identificacao: '600',
        nome: 'Marcia Marques',
        email: 'marques.mcc@gmail.com',
        telefone: '21996428346',
        documento: '00036241709',
        tipo_documento: 'CPF',
        cnpj: '42498733000148',
        razao_social: 'MUNICIPIO DE RIO DE JANEIRO',
        nome_fantasia: 'RIO DE JANEIRO GABINETE DO PREFEITO',
      },
      {
        numero_identificacao: '601',
        nome: 'Carlos Silva',
        email: 'carlos.silva@example.com',
        telefone: '21998887766',
        documento: '12345678901',
        tipo_documento: 'CPF',
        cnpj: '11222333000144',
        razao_social: 'ASSOCIACAO OPERACIONAL CENTRO',
        nome_fantasia: 'AOC CENTRO',
      },
    ];

    return this.agentesSyncService.syncWeeklyAgentUsers(mockRows);
  }
}
