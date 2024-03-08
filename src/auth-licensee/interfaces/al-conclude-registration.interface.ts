import { User } from 'src/users/entities/user.entity';

/**
 * Interface Auth licensee Conclude registration
 */
export interface IALConcludeRegistration {
  token: string;
  user: User;
}
