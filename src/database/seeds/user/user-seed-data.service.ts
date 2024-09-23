import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigquerySource, BigqueryService } from 'src/bigquery/bigquery.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { UserSeedDataInterface } from 'src/users/interfaces/user-seed-data.interface';

@Injectable()
export class UserSeedDataService {
  nodeEnv = (): string => '';
  cpfSamples: string[] = [];
  cnpjSamples: string[] = [];

  constructor(private configService: ConfigService, private bigqueryService: BigqueryService) {
    this.nodeEnv = () => this.configService.getOrThrow('app.nodeEnv', { infer: true });
  }

  async getData(): Promise<UserSeedDataInterface[]> {
    if (this.nodeEnv() === 'local' || this.nodeEnv() === 'test') {
      if (this.cpfSamples.length === 0) {
        this.cpfSamples = (
          await this.bigqueryService.query(
            BigquerySource.smtr,
            `
SELECT
  DISTINCT o.documento,
FROM \`rj-smtr-dev.cadastro.operadoras\` o
LEFT JOIN \`rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.transacao\` t ON t.id_operadora = o.id_operadora
WHERE t.modo = 'Van'
LIMIT 5
          `,
          )
        ).reduce((l: string[], i) => [...l, i['documento']], []);
      }
      if (this.cnpjSamples.length === 0) {
        this.cnpjSamples = (
          await this.bigqueryService.query(
            BigquerySource.smtr,
            `
SELECT
  DISTINCT c.cnpj,
FROM \`rj-smtr-dev.cadastro.consorcios\` c
LEFT JOIN \`rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.transacao\` t ON t.id_consorcio = c.id_consorcio
WHERE t.modo != 'Van' AND c.cnpj IS NOT NULL
LIMIT 5
          `,
          )
        ).reduce((l: string[], i) => [...l, i['cnpj']], []);
      }
    }

    return [
      // Dev team
      {
        fullName: 'Alexander Rivail Ruiz',
        email: 'ruiz.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.master),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Bernardo Marcos',
        email: 'bernardo.marcos64@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.master),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Gabriel Fortes',
        email: 'glfg01092001@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.master),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Raphael Baptista Rivas de Araújo',
        email: 'raphaelrivasbra@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.master),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'William FL 2007',
        email: 'williamfl2007@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.master),
        status: new Status(StatusEnum.active),
      },

      // Admin Master
      {
        fullName: 'Lauro Costa Silvestre',
        email: 'laurosilvestre.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.master),
        status: new Status(StatusEnum.active),
      },

      // Admin Vanzeiro
      {
        fullName: 'Felipe Ribeiro',
        email: 'felipe.ribeiro@prefeitura.rio',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Monique Lopes',
        email: 'monique.lopes@prefeitura.rio',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.admin),
        status: new Status(StatusEnum.active),
      },
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
        fullName: 'Admin bigquery',
        email: 'admin_bigquery@example.com',
        password: 'secret',
        role: { id: RoleEnum.admin } as Role,
        status: { id: StatusEnum.active } as Status,
      },

      // Admin lançamento
      {
        fullName: 'Simone Costa',
        email: 'simonecosta.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.aprovador_financeiro),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Luciana Fernandes',
        email: 'lucianafernandes.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.aprovador_financeiro),
        status: new Status(StatusEnum.active),
      },

      // Usuário lançamento
      {
        fullName: 'Usuário lançamento',
        email: 'ruizalexander@id.uff.br',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.lancador_financeiro),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'João Victor Spala',
        email: 'jvspala.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.lancador_financeiro),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Marcia Marques',
        email: 'marques.mcc@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.lancador_financeiro),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Letícia Correa',
        email: 'leticiacorrea.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.lancador_financeiro),
        status: new Status(StatusEnum.active),
      },
      {
        fullName: 'Louise Sanglard',
        email: 'louise.smtr@gmail.com',
        password: this.generateRandomPassword(),
        role: new Role(RoleEnum.lancador_financeiro),
        status: new Status(StatusEnum.active),
      },

      //apagar após teste
      {
        fullName: 'alex test seed approval',
        email: 'approval@example.com',
        password: 'secret',
        permitCode: '',
        cpfCnpj: this.cpfSamples?.[0],
        role: { id: RoleEnum.lancador_financeiro } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        fullName: 'teste approval',
        email: 'approval@example.com',
        password: 'secret',
        permitCode: '',
        cpfCnpj: this.cpfSamples?.[0],
        role: { id: RoleEnum.lancador_financeiro } as Role,
        status: { id: StatusEnum.active } as Status,
      },
      {
        fullName: 'teste launcher',
        email: 'launcher@example.com',
        password: 'secret',
        permitCode: '',
        cpfCnpj: this.cpfSamples?.[0],
        role: { id: RoleEnum.aprovador_financeiro } as Role,
        status: { id: StatusEnum.active } as Status,
      },

      // Development only
      ...(this.nodeEnv() === 'local' || this.nodeEnv() === 'test'
        ? ([
            // Vanzeiros
            {
              fullName: 'Henrique Santos Template Cpf Van',
              email: 'henrique@example.com',
              password: 'secret',
              permitCode: '213890329890312',
              cpfCnpj: this.cpfSamples?.[0],
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
              bankAccount: '000000000567',
              bankAccountDigit: '8',
            },
            {
              fullName: 'Márcia Clara Template Cnpj Brt etc',
              email: 'marcia@example.com',
              password: 'secret',
              permitCode: '319274392832023',
              cpfCnpj: this.cnpjSamples?.[0],
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            // Roles
            {
              fullName: 'Usuário Teste dos Santos Oliveira',
              email: 'user@example.com',
              password: 'secret',
              permitCode: '213890329890749',
              cpfCnpj: this.cpfSamples?.[0],
              role: { id: RoleEnum.user } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Lançador Financeiro Teste',
              email: 'finan.lancador@example.com',
              password: 'ob>&+H%=<!?J',
              permitCode: 'permitCode_admin',
              role: { id: RoleEnum.lancador_financeiro } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Aprovador Financeiro Teste',
              email: 'finan.aprovador@example.com',
              password: 'ob>&+H%=<!?J',
              permitCode: 'permitCode_admin',
              role: { id: RoleEnum.aprovador_financeiro } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            {
              fullName: 'Admin Master Teste',
              email: 'master.admin@example.com',
              password: 'ob>&+H%=<!?J',
              permitCode: 'permitCode_admin',
              role: { id: RoleEnum.master } as Role,
              status: { id: StatusEnum.active } as Status,
            },
            // {
            //   fullName: 'Administrador Teste',
            //   email: 'admin@example.com',
            //   password: 'secret',
            //   permitCode: 'permitCode_admin',
            //   role: { id: RoleEnum.admin } as Role,
            //   status: { id: StatusEnum.active } as Status,
            // },
            // {
            //   fullName: 'Administrador Teste 2',
            //   email: 'admin2@example.com',
            //   password: 'secret',
            //   permitCode: 'permitCode_admin2',
            //   role: { id: RoleEnum.admin } as Role,
            //   status: { id: StatusEnum.active } as Status,
            // },
            // // User mail status
            // {
            //   fullName: 'Queued user',
            //   email: 'queued.user@example.com',
            //   password: 'secret',
            //   permitCode: '319274392832024',
            //   role: { id: RoleEnum.user } as Role,
            //   status: { id: StatusEnum.active } as Status,
            //   inviteStatus: new InviteStatus(InviteStatusEnum.queued),
            // },
            // {
            //   fullName: 'Sent user',
            //   email: 'sent.user@example.com',
            //   password: 'secret',
            //   permitCode: '319274392832024',
            //   role: { id: RoleEnum.user } as Role,
            //   status: { id: StatusEnum.active } as Status,
            //   inviteStatus: new InviteStatus(InviteStatusEnum.sent),
            // },
            // {
            //   fullName: 'Sent user with fifteen days',
            //   email: 'sent15.user@example.com',
            //   password: 'secret',
            //   permitCode: '319274392832025',
            //   role: { id: RoleEnum.user } as Role,
            //   status: { id: StatusEnum.active } as Status,
            //   inviteStatus: new InviteStatus(InviteStatusEnum.sent),
            // },
            // {
            //   fullName: 'Used user',
            //   email: 'used.user@example.com',
            //   password: 'secret',
            //   permitCode: '319274392832026',
            //   role: { id: RoleEnum.user } as Role,
            //   status: { id: StatusEnum.active } as Status,
            //   inviteStatus: new InviteStatus(InviteStatusEnum.used),
            // },
            // {
            //   fullName: 'Used registered user',
            //   email: 'registered.user@example.com',
            //   password: 'secret',
            //   permitCode: '319274392832027',
            //   role: { id: RoleEnum.user } as Role,
            //   status: { id: StatusEnum.active } as Status,
            //   inviteStatus: new InviteStatus(InviteStatusEnum.used),
            //   bankCode: 104,
            //   bankAgency: '1234',
            //   bankAccount: '000000012345',
            //   bankAccountDigit: '1',
            // },
            // // CRUD
            // {
            //   fullName: 'User to update',
            //   email: 'to_update.user@example.com',
            //   password: 'secret',
            //   permitCode: '319274392832025',
            //   role: { id: RoleEnum.user } as Role,
            //   status: { id: StatusEnum.active } as Status,
            //   inviteStatus: new InviteStatus(InviteStatusEnum.used),
            // },
          ] as UserSeedDataInterface[])
        : []),
    ];
  }

  private generateRandomPassword(): string {
    const length = 10;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset.charAt(randomIndex);
    }

    return password;
  }
}
