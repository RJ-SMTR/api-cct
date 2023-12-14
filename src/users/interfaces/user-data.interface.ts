import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { Role } from 'src/roles/entities/role.entity';
import { Status } from 'src/statuses/entities/status.entity';

export interface UserDataInterface {
  id?: number;
  hash?: string;
  permitCode?: string;
  fullName: string;
  email: string;
  password?: string;
  role: Role;
  status: Status;
  inviteStatus?: InviteStatus;
}
