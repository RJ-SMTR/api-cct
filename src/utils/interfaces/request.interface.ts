import { User } from 'src/users/entities/user.entity';
import { DeepPartial } from 'typeorm';

export interface IRequest {
  user?: DeepPartial<User>;
}
