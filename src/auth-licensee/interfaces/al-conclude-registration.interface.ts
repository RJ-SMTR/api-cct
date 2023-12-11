import { User } from 'src/users/entities/user.entity';

export interface IALConcludeRegistration {
  token: string;
  user: User;
}
