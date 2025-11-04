import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';

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
