import { Injectable } from '@nestjs/common';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';

@Injectable()
export class UserSeedDataService {
  getDataFromConfig(): UserDataInterface[] {
    return [
      {
        id: 1,
        fullName: 'Ademar',
        email: 'admin@example.com',
        password: 'secret',
        permitCode: '',
        role: { id: RoleEnum.admin } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        id: 2,
        fullName: 'Henrique Santos',
        email: 'henrique@example.com',
        password: 'secret',
        permitCode: '213890329890312',
        role: { id: RoleEnum.user } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        id: 3,
        fullName: 'Márcia Clara',
        email: 'marcia@example.com',
        password: 'secret',
        permitCode: '319274392832023',
        role: { id: RoleEnum.user } as Role,
        status: { id: StatusEnum.active } as Status,
      },
    ];
  }
}
