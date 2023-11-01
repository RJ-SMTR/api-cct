import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { startOfDay } from 'date-fns';
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';
import { User } from 'src/users/entities/user.entity';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { DeepPartial, Equal, MoreThanOrEqual, Repository } from 'typeorm';
import { MailHistory } from './entities/invite.entity';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailHistoryService {
  constructor(
    @InjectRepository(MailHistory)
    private inviteRepository: Repository<MailHistory>,
    private configService: ConfigService,
  ) {}
  f;

  create(data: DeepPartial<MailHistory>): Promise<MailHistory> {
    return this.inviteRepository.save(this.inviteRepository.create(data));
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

  update(id: number, payload: DeepPartial<MailHistory>): Promise<MailHistory> {
    return this.inviteRepository.save(
      this.inviteRepository.create({
        id,
        ...payload,
      }),
    );
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
}
