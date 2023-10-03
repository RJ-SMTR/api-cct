import { User } from '../entities/user.entity';

export interface FileUserInterface {
  row?: number;
  user: Partial<User>;
  errors: Partial<User>;
}
