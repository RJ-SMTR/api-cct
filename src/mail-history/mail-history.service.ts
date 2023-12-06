import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { startOfDay } from 'date-fns';
import { IMailHistoryStatusCount } from 'src/mail-history-statuses/interfaces/mail-history-status-group.interface';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { formatLog } from 'src/utils/logging';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
  DataSource,
  DeepPartial,
  Equal,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { MailHistory } from './entities/mail-history.entity';

@Injectable()
export class MailHistoryService {
  private logger: Logger = new Logger('MailHistoryService', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(MailHistory)
    private inviteRepository: Repository<MailHistory>,
    private configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    data: DeepPartial<MailHistory>,
    logContext?: string,
  ): Promise<MailHistory> {
    const createdMail = await this.inviteRepository.save(
      this.inviteRepository.create(data),
    );
    this.logger.log(
      formatLog(
        `Histórico de email ${createdMail.getLogInfoStr()}` +
          ` criado com sucesso.`,
        'create()',
        logContext,
      ),
    );
    return createdMail;
  }

  async find(
    fields?: EntityCondition<MailHistory> | EntityCondition<MailHistory>[],
  ): Promise<NullableType<MailHistory[]>> {
    return this.inviteRepository.find({
      where: fields,
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findSentToday(): Promise<NullableType<MailHistory[]>> {
    return this.inviteRepository.find({
      where: {
        sentAt: MoreThanOrEqual(startOfDay(new Date(Date.now()))),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findUnsent(): Promise<NullableType<MailHistory[]>> {
    return this.inviteRepository.find({
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

  findRecentByUser(user: User | null): Promise<MailHistory | null> {
    if (user === null) {
      return new Promise(() => null);
    }
    return this.inviteRepository.findOne({
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
  ): Promise<NullableType<MailHistory>> {
    return this.inviteRepository.findOne({
      where: fields,
    });
  }

  async getOne(fields: EntityCondition<MailHistory>): Promise<MailHistory> {
    const mailHistory = await this.inviteRepository.findOne({
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
    const updatedMail = await this.inviteRepository.save(
      this.inviteRepository.create({
        id,
        ...payload,
      }),
    );
    this.logger.log(
      formatLog(
        `Histórico de email ${updatedMail.getLogInfoStr()}` +
          ` teve os campos atualizados: [ ${Object.keys(payload)} ]`,
        'update()',
        logContext,
      ),
    );
    return updatedMail;
  }

  async softDelete(id: number): Promise<void> {
    await this.inviteRepository.softDelete(id);
  }

  async getLine(inviteId: number): Promise<MailHistory> {
    const invite = await this.inviteRepository.findOne({
      where: {
        id: inviteId,
      },
    });
    if (!invite) {
      throw new HttpException(
        {
          error: HttpErrorMessages.NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return invite;
  }

  async getRemainingQuota(): Promise<number> {
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');
    const sentToday = await this.inviteRepository
      .createQueryBuilder()
      .where({ sentAt: MoreThanOrEqual(startOfDay(new Date())) })
      .orderBy({ createdAt: 'ASC' })
      .getCount();
    return dailyQuota() - sentToday;
  }

  async getStatusCount(): Promise<IMailHistoryStatusCount> {
    const result: any[] = await this.inviteRepository
      .createQueryBuilder('invite')
      .select([
        'invite.inviteStatus as status_id',
        'COUNT(invite.inviteStatus) as status_count',
      ])
      .leftJoin('invite.user', 'user')
      .leftJoin('user.role', 'role')
      .where('role.id = :roleId', { roleId: RoleEnum.user })
      .groupBy('invite.inviteStatusId')
      .getRawMany();

    const resultReturn = {
      queued:
        Number(
          result.filter((i) => i.status_id === InviteStatusEnum.queued)[0]
            ?.status_count,
        ) || 0,
      sent:
        Number(
          result.filter((i) => i.status_id === InviteStatusEnum.sent)[0]
            ?.status_count,
        ) || 0,
      used:
        Number(
          result.filter((i) => i.status_id === InviteStatusEnum.used)[0]
            ?.status_count,
        ) || 0,
      total: 0,
    };
    resultReturn.total =
      resultReturn.queued + resultReturn.sent + resultReturn.used;
    return resultReturn;
  }
}
