import { User } from "src/domain/entity/user.entity";

export type LoginResponseType = Readonly<{
  token: string;
  user: User;
}>;
