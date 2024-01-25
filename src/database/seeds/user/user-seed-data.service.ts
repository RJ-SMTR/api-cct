import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BQSInstances, BigqueryService } from 'src/bigquery/bigquery.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';

@Injectable()
export class UserSeedDataService {
  nodeEnv = (): string => '';

  constructor(
    private configService: ConfigService,
    private bigqueryService: BigqueryService,
  ) {
    this.nodeEnv = () =>
      this.configService.getOrThrow('app.nodeEnv', { infer: true });
  }

  async getDataFromConfig(): Promise<UserDataInterface[]> {
    let cpfCnpjSamples: string[] = [];

    if (this.nodeEnv() === 'local' || this.nodeEnv() === 'test') {
      cpfCnpjSamples = (
        await this.bigqueryService.runQuery(
          BQSInstances.smtr,
          `
          SELECT
            DISTINCT o.documento,
          FROM \`rj-smtr.cadastro.operadoras\` o
          LEFT JOIN \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t ON t.id_operadora = o.id_operadora
          WHERE t.modo = 'Van'
          LIMIT 10
        `,
        )
      ).reduce((l: string[], i) => [...l, i['documento']], []);
    }

    return [
      // Dev team
      {
        fullName: 'Alexander Rivail Ruiz',
        email: 'ruiz.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Bernardo Marcos',
        email: 'bernardo.marcos64@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Gabriel Fortes',
        email: 'glfg01092001@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Raphael Baptista Rivas de Araújo',
        email: 'raphaelrivasbra@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'William FL 2007',
        email: 'williamfl2007@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },

      // Admins
      {
        fullName: 'Jéssica Venancio Teixeira Cardoso Simas',
        email: 'jessicasimas.smtr@gmail.com',
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

      // Development only
      ...(this.nodeEnv() === 'local' || this.nodeEnv() === 'test'
        ? ([
            {
              fullName: 'Henrique Santos Template',
              email: 'henrique@example.com',
              password: 'secret',
              permitCode: '213890329890312',
              cpfCnpj: cpfCnpjSamples.pop(),
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Márcia Clara Template',
              email: 'marcia@example.com',
              password: 'secret',
              permitCode: '319274392832023',
              cpfCnpj: cpfCnpjSamples.pop(),
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Administrador Teste',
              email: 'admin@example.com',
              password: 'secret',
              permitCode: 'permitCode_admin',
              role: { id: RoleEnum.admin } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Administrador Teste 2',
              email: 'admin2@example.com',
              password: 'secret',
              permitCode: 'permitCode_admin2',
              role: { id: RoleEnum.admin } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Queued user',
              email: 'queued.user@example.com',
              password: 'secret',
              permitCode: '319274392832024',
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
              inviteStatus: new InviteStatus(InviteStatusEnum.queued),
            },
            {
              fullName: 'Sent user',
              email: 'sent.user@example.com',
              password: 'secret',
              permitCode: '319274392832024',
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
              inviteStatus: new InviteStatus(InviteStatusEnum.sent),
            },
            {
              fullName: 'Used user',
              email: 'used.user@example.com',
              password: 'secret',
              permitCode: '319274392832024',
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
              inviteStatus: new InviteStatus(InviteStatusEnum.used),
            },
          ] as UserDataInterface[])
        : []),
    ];
  }

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
}
