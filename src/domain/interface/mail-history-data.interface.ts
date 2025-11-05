import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';
import { User } from '../entity/user.entity';

export interface IMailSeedData {
  id?: number;
  user: User;
  email?: string;
  inviteStatus: InviteStatus;
  hash?: string;
  sentAt?: Date;
}
