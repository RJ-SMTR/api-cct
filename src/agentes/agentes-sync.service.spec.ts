import { Test, TestingModule } from '@nestjs/testing';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { UsersRepository } from 'src/users/users.repository';
import { AgentesBigqueryRepository } from './agentes-bigquery.repository';
import { AgentesSyncService } from './agentes-sync.service';
import { AgenteBigqueryUser } from './interfaces/agente-bigquery-user.interface';
import { it } from 'date-fns/locale';
import { describe, beforeEach } from 'node:test';
import { StatusEnum } from 'src/statuses/statuses.enum';

describe('AgentesSyncService', () => {
  let service: AgentesSyncService;
  let usersRepository: UsersRepository;
  let mailHistoryService: MailHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentesSyncService,
        {
          provide: AgentesBigqueryRepository,
          useValue: {
            findUsersToSync: jest.fn(),
          },
        },
        {
          provide: UsersRepository,
          useValue: {
            findManyByNormalizedCpf: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: MailHistoryService,
          useValue: {
            generateHash: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AgentesSyncService>(AgentesSyncService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
  });

  it('creates association and agent users and queues invite for the new agent', async () => {
    const row: AgenteBigqueryUser = {
      numero_identificacao: '600',
      nome: 'Marcia Marques',
      email: 'marques.mcc@gmail.com',
      telefone: '21996428346',
      documento: '00036241709',
      tipo_documento: 'CPF',
      cnpj: '42498733000148',
      razao_social: 'MUNICIPIO DE RIO DE JANEIRO',
      nome_fantasia: 'RIO DE JANEIRO GABINETE DO PREFEITO',
    };

    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    jest
      .spyOn(usersRepository, 'create')
      .mockResolvedValueOnce({ id: 10 } as User)
      .mockResolvedValueOnce({ id: 20 } as User);
    jest
      .spyOn(mailHistoryService, 'generateHash')
      .mockResolvedValue('generated-hash');

    const result = await service.syncWeeklyAgentUsers([row]);

    expect(result).toEqual({
      processedRows: 1,
      createdAgentUsers: 1,
      createdAssociationUsers: 1,
      queuedInvites: 1,
      skippedExistingAgents: 0,
      skippedExistingAssociations: 0,
    });
    expect(usersRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        email: expect.stringMatching(/^user\+0\.\d+@example\.com$/),
        fullName: 'MUNICIPIO DE RIO DE JANEIRO',
        cpfCnpj: '42498733000148',
        role: expect.objectContaining({ id: RoleEnum.admin }),
        status: null,
        permitCode: undefined,
        phone: '5551999999999',
      }),
    );
    expect(usersRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        permitCode: '600',
        fullName: 'MARCIA MARQUES',
        cpfCnpj: '00036241709',
        email: 'marques.mcc@gmail.com',
        role: expect.objectContaining({ id: RoleEnum.agents }),
        status: expect.objectContaining({ id: StatusEnum.register }),
      }),
    );
    expect(mailHistoryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 20 },
        email: 'marques.mcc@gmail.com',
        hash: 'generated-hash',
        inviteStatus: { id: InviteStatusEnum.queued },
      }),
      'AgentesSyncService.syncWeeklyAgentUsers()',
    );
  });

  it('skips duplicate association and duplicate agent users', async () => {
    const row: AgenteBigqueryUser = {
      numero_identificacao: '600',
      nome: 'Marcia Marques',
      email: 'marques.mcc@gmail.com',
      telefone: '21996428346',
      documento: '00036241709',
      tipo_documento: 'CPF',
      cnpj: '42498733000148',
      razao_social: 'MUNICIPIO DE RIO DE JANEIRO',
      nome_fantasia: 'RIO DE JANEIRO GABINETE DO PREFEITO',
    };

    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([{ id: 10 } as User])
      .mockResolvedValueOnce([{ id: 20 } as User]);

    const result = await service.syncWeeklyAgentUsers([row]);

    expect(result).toEqual({
      processedRows: 1,
      createdAgentUsers: 0,
      createdAssociationUsers: 0,
      queuedInvites: 0,
      skippedExistingAgents: 1,
      skippedExistingAssociations: 1,
    });
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(mailHistoryService.create).not.toHaveBeenCalled();
  });
}
