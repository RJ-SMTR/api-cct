import { User } from 'src/users/entities/user.entity';

export class IBSGetMeDayArgs {
  endDate: string;
  userId?: number;
}

export class IBSGetMeDayValidArgs {
  endDate: string;
  user: User;
}
