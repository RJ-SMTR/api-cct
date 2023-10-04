import { Injectable } from '@nestjs/common';
import { NullableType } from 'src/utils/types/nullable.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';
import { DeepPartial, Equal, Repository } from 'typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class InviteService {
  constructor(
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
  ) {}

  create(data: DeepPartial<Invite>): Promise<Invite> {
    return this.inviteRepository.save(this.inviteRepository.create(data));
  }

  findByHash(hash: string): Promise<NullableType<Invite>> {
    return this.inviteRepository.findOne({
      where: {
        hash: Equal(hash),
      },
    });
  }

  findRecentByUser(user: User | null): Promise<Invite | null> {
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

  findOne(fields: EntityCondition<Invite>): Promise<NullableType<Invite>> {
    return this.inviteRepository.findOne({
      where: fields,
    });
  }

  update(id: number, payload: DeepPartial<Invite>): Promise<Invite> {
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
}
