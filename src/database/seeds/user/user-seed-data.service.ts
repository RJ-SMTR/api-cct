import { Injectable } from '@nestjs/common';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';

@Injectable()
export class UserSeedDataService {
  private generateRandomPassword(): string {
    const length = 10;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset.charAt(randomIndex);
    }

    return password;
  }

  getDataFromConfig(): UserDataInterface[] {
    return [
      {
        id: 1,
        fullName: 'Administrador',
        email: 'admin@example.com',
        password: 'secret',
        permitCode: '',
        role: { id: RoleEnum.admin } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        id: 2,
        fullName: 'Henrique Santos Template',
        email: 'henrique@example.com',
        password: 'secret',
        permitCode: '213890329890312',
        role: { id: RoleEnum.user } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        id: 3,
        fullName: 'Márcia Clara Template',
        email: 'marcia@example.com',
        password: 'secret',
        permitCode: '319274392832023',
        role: { id: RoleEnum.user } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        fullName: 'Jéssica Venancio Teixeira Cardoso Simas',
        email: 'jessicasimas.smtr@gmail.com ',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Leandro Almeida dos Santos',
        email: 'leandro.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Carolina Maia dos Santos',
        email: 'cms.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Carolina Salomé Kingma Orlando',
        email: 'carolkingma2013@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Lauro Costa Silvestre',
        email: 'laurosilvestre.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
    ];
  }
}
