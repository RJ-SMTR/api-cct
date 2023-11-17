import { Role } from 'src/roles/entities/role.entity';
import { Status } from 'src/statuses/entities/status.entity';

export interface UserDataInterface {
  id?: number;
  permitCode?: string;
  fullName: string;
  email: string;
  password: string;
  role: Role;
  status: Status;
}
