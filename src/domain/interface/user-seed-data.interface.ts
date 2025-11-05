import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';
import { Role } from 'src/security/roles/entities/role.entity';
import { Status } from 'src/domain/entity/status.entity';

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
