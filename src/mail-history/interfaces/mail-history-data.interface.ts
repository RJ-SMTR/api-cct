import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { User } from 'src/users/entities/user.entity';

export interface IMailSeedData {
  id?: number;
  user: User;
  email?: string;
  inviteStatus: InviteStatus;
  hash?: string;
  sentAt?: Date;
}
