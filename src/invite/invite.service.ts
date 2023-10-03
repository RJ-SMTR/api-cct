import { Injectable } from '@nestjs/common';
import { inviteMockup } from './data/invite-mockup';
import { InviteInterface } from './interface/invite.interface';
import { NullableType } from 'src/utils/types/nullable.type';

@Injectable()
export class InviteService {
  findByHash(hash: string): NullableType<InviteInterface> {
    return inviteMockup.find((item) => item.hash === hash) || null;
  }
}
