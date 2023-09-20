import { User } from '../entities/user.entity';

export interface ExcelUsersInterface {
  excelRow?: number;
  user: Partial<User>;
  errors: Partial<User>;
}
