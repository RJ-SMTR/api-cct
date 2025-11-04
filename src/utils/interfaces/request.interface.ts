import { Role } from '../../security/roles/entities/role.entity';

export interface IRequest {
  user: {
    id: number,
    role: Role
  };
  method: string;
  protocol: string;
  originalUrl: string;
  get(x: string): any;
}
