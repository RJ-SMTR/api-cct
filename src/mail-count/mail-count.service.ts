import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { MailCount } from './entities/mail-count.entity';

@Injectable()
export class MailCountService {
  constructor(
    @InjectRepository(MailCount)
    private mailCountRepository: Repository<MailCount>,
  ) {}

  async getUpdatedMailCounts(ignoreFilledCounts = false): Promise<MailCount[]> {
    const allCounts = await this.mailCountRepository.find();
    const updatedCounts: MailCount[] = [];
    for (let i = 0; i < allCounts.length; i++) {
      const mailCount = { ...allCounts[i] } as MailCount;
      const hoursDifference =
        (new Date(Date.now()).getTime() - mailCount.updatedAt.getTime()) /
        (1000 * 60 * 60);
      if (hoursDifference >= 24) {
        mailCount.recipientCount = 0;
        await this.update(mailCount.id, mailCount);
      }
      if (
        !ignoreFilledCounts ||
        mailCount.recipientCount < mailCount.maxRecipients
      ) {
        updatedCounts.push(mailCount);
      }
    }
    return updatedCounts;
  }

  update(id: number, payload: DeepPartial<MailCount>): Promise<MailCount> {
    return this.mailCountRepository.save(
      this.mailCountRepository.create({
        id,
        ...payload,
      }),
    );
  }

  async getAll(): Promise<Nullable<MailCount[]>> {
    return this.mailCountRepository.find();
  }
}
