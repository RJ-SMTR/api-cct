import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { Role } from 'src/roles/entities/role.entity';
import { Status } from 'src/statuses/entities/status.entity';

export interface UserSeedDataInterface {
  id?: number;
  hash?: string;
  permitCode?: string;
  cpfCnpj?: string;
  fullName: string;
  email: string;
  password?: string;
  role: Role;
  status: Status;
  inviteStatus?: InviteStatus;
  bankCode?: number;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountDigit?: string;
}
