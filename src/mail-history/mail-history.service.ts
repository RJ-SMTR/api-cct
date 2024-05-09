import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { startOfDay } from 'date-fns';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { IMailHistoryStatusCount } from 'src/mail-history-statuses/interfaces/mail-history-status-group.interface';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { CustomLogger } from 'src/utils/custom-logger';
import { HttpStatusMessage } from 'src/utils/enums/http-error-message.enum';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import {
  DeepPartial,
  EntityManager,
  Equal,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { MailHistory } from './entities/mail-history.entity';

@Injectable()
export class MailHistoryService {
  private logger: CustomLogger = new CustomLogger('MailHistoryService', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(MailHistory)
    private mailHistoryRepository: Repository<MailHistory>,
    private configService: ConfigService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(
    data: DeepPartial<MailHistory>,
    logContext?: string,
  ): Promise<MailHistory> {
    const METHOD = this.create.name;
    const createdMail = await this.mailHistoryRepository.save(
      this.mailHistoryRepository.create(data),
    );
    this.logger.log(
      `Histórico de email ${createdMail.getLogInfoStr()}` +
        ` criado com sucesso.`,
      `${logContext} from ${METHOD}`,
    );
    return createdMail;
  }

  async find(fields?: EntityCondition<MailHistory>): Promise<MailHistory[]> {
    return this.mailHistoryRepository.find({
      where: fields,
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findSentToday(): Promise<Nullable<MailHistory[]>> {
    return this.mailHistoryRepository.find({
      where: {
        sentAt: MoreThanOrEqual(startOfDay(new Date(Date.now()))),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findUnsent(): Promise<Nullable<MailHistory[]>> {
    return this.mailHistoryRepository.find({
      where: {
        inviteStatus: { id: InviteStatusEnum.queued },
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async generateHash(): Promise<string> {
    let hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    while (await this.findOne({ hash })) {
      hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
    }
    return hash;
  }

  async findManyRecentByUser(users: User[]): Promise<MailHistory[]> {
    const userIDs = users.map((i) => i.id);
    if (users.length === 0) {
      return [];
    }
    const raw = await this.mailHistoryRepository
      .createQueryBuilder('invite')
      .select('invite.*')
      .where('invite.userId IN (:...userIds)', { userIds: userIDs })
      // .addGroupBy('invite.userId')
      .orderBy('invite.userId', 'DESC')
      .getRawMany();
    const entities: MailHistory[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      // user
      item.user = { id: item['userId'] } as DeepPartial<User>;
      delete item.userId;
      // inviteStatus
      item.inviteStatus = {
        id: item['inviteStatusId'],
      } as DeepPartial<InviteStatus>;
      delete item.inviteStatusId;
      entities.push(new MailHistory(item));
    }
    return entities;
  }

  findRecentByUser(user: User | null): Promise<MailHistory | null> {
    if (user === null) {
      return new Promise(() => null);
    }
    return this.mailHistoryRepository.findOne({
      where: {
        user: Equal(user?.id),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findOne(
    fields: EntityCondition<MailHistory>,
  ): Promise<Nullable<MailHistory>> {
    return this.mailHistoryRepository.findOne({
      where: fields,
    });
  }

  async getOne(fields: EntityCondition<MailHistory>): Promise<MailHistory> {
    const mailHistory = await this.mailHistoryRepository.findOne({
      where: fields,
    });
    if (!mailHistory) {
      throw new HttpException(
        {
          details: {
            message: 'invite not found',
            mailHistory,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      return mailHistory;
    }
  }

  async update(
    id: number,
    payload: DeepPartial<MailHistory>,
    logContext?: string,
  ): Promise<MailHistory> {
    const METHOD = MailHistoryService.name;
    const mailRespose = await this.mailHistoryRepository.save(
      this.mailHistoryRepository.create({
        id,
        ...payload,
      }),
    );
    const updatedMail = await this.mailHistoryRepository.findOneByOrFail({
      id: id,
    });
    this.logger.log(
      `Histórico de email ${updatedMail.getLogInfoStr()}` +
        ` teve os campos atualizados: [ ${Object.keys(payload)} ]`,
      `${METHOD} from ${logContext}`,
    );
    return mailRespose;
  }

  async softDelete(id: number): Promise<void> {
    await this.mailHistoryRepository.softDelete(id);
  }

  async getLine(inviteId: number): Promise<MailHistory> {
    const invite = await this.mailHistoryRepository.findOne({
      where: {
        id: inviteId,
      },
    });
    if (!invite) {
      throw new HttpException(
        {
          error: HttpStatusMessage.NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return invite;
  }

  async getRemainingQuota(): Promise<number> {
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');
    const sentToday = await this.mailHistoryRepository
      .createQueryBuilder()
      .where({ sentAt: MoreThanOrEqual(startOfDay(new Date())) })
      .orderBy({ createdAt: 'ASC' })
      .getCount();
    return dailyQuota() - sentToday;
  }

  async getStatusCount(): Promise<IMailHistoryStatusCount> {
    const result: any[] = await this.mailHistoryRepository
      .createQueryBuilder('invite')
      .select([
        'invite.inviteStatus as status_id',
        'COUNT(invite.inviteStatus) as status_count',
        `CASE ` +
          `WHEN ( ` +
          `"user"."fullName" IS NOT NULL AND "user"."fullName" != '' AND ` +
          `"user"."cpfCnpj" IS NOT NULL AND "user"."cpfCnpj" != '' AND ` +
          `"user"."permitCode" IS NOT NULL AND "user"."permitCode" != '' AND ` +
          `"user"."email" IS NOT NULL AND "user"."email" != '' AND ` +
          `"user"."phone" IS NOT NULL AND "user"."phone" != '' AND ` +
          `"user"."bankCode" IS NOT NULL AND ` +
          `"user"."bankAgency" IS NOT NULL AND "user"."bankAgency" != '' AND ` +
          `"user"."bankAccount" IS NOT NULL AND "user"."bankAccount" != '' AND ` +
          `"user"."bankAccountDigit" IS NOT NULL AND "user"."bankAccountDigit" != '' ` +
          ')' +
          'THEN true ' +
          'ELSE false ' +
          'END AS is_filled',
      ])
      .leftJoin('invite.user', 'user')
      .leftJoin('user.role', 'role')
      .where('role.id = :roleId', { roleId: RoleEnum.user })
      .groupBy('invite.inviteStatusId')
      .addGroupBy('is_filled')
      .getRawMany();

    const resultReturn = {
      queued: result.reduce(
        (sum, i) =>
          i.status_id === InviteStatusEnum.queued
            ? sum + Number(i.status_count)
            : sum,
        0,
      ),
      sent: result.reduce(
        (sum, i) =>
          i.status_id === InviteStatusEnum.sent
            ? sum + Number(i.status_count)
            : sum,
        0,
      ),
      used: result.reduce(
        (sum, i) =>
          i.status_id === InviteStatusEnum.used
            ? sum + Number(i.status_count)
            : sum,
        0,
      ),
      usedIncomplete: result.reduce(
        (sum, i) =>
          i.status_id === InviteStatusEnum.used && i.is_filled === false
            ? sum + Number(i.status_count)
            : sum,
        0,
      ),
      usedComplete: result.reduce(
        (sum, i) =>
          i.status_id === InviteStatusEnum.used && i.is_filled === true
            ? sum + Number(i.status_count)
            : sum,
        0,
      ),
      total: 0,
    };
    resultReturn.total =
      resultReturn.queued + resultReturn.sent + resultReturn.used;
    return resultReturn;
  }
}
