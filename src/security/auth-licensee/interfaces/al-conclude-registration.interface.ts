import { User } from "src/domain/entity/user.entity";

/**
 * Interface Auth licensee Conclude registration
 */
export interface IALConcludeRegistration {
  token: string;
  user: User;
}
