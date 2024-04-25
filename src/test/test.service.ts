import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { UsersService } from 'src/users/users.service';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { In } from 'typeorm/find-options/operator/In';

@Injectable()
export class TestService {
  constructor(
    private readonly cronjobsService: CronJobsService,
    private readonly mailHistoryService: MailHistoryService,
    private readonly usersService: UsersService,
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
      (await this.mailHistoryService.findMany({
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
    const invalidCpfs = common.filter((i) => !isCpfOrCnpj(i.cpfCnpj));
    const validCpfs = common.filter((i) => isCpfOrCnpj(i.cpfCnpj));
    return {
      commonCount: common.length,
      validCount: validCpfs.length,
      invalidCount: invalidCpfs.length,
      // valid: validCpfs.map((i) => ({
      //   cpfCnpj: i.cpfCnpj,
      //   tipoDocumento: isCpfOrCnpj(i.cpfCnpj),
      // })),
      invalid: invalidCpfs.map((i) => ({
        nome: i.fullName,
        cpf: i.cpfCnpj,
        permissionario: i.permitCode,
        telefone: i.phone,
        email: i.email,
      })),
    };
  }

  async updateUserFiles(files: Express.Multer.File[], request: IRequest) {
    return await this.usersService.updateFromFiles(
      files,
      ['cpf'],
      request.user,
    );
  }
}
