import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';

/**
 * Interface Auth licensee Invite profile
 */
export interface IALInviteProfile {
  hash: string;
  permitCode: string;
  email: string;
  fullName: string;
  inviteStatus: InviteStatus;
}
