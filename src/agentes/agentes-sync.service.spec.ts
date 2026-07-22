import { Test, TestingModule } from '@nestjs/testing';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { appSettings } from 'src/settings/app.settings';
import { SettingsService } from 'src/settings/settings.service';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { User } from 'src/users/entities/user.entity';
import { UsersRepository } from 'src/users/users.repository';
import { AgentesBigqueryRepository } from './agentes-bigquery.repository';
import { AgentesSyncService } from './agentes-sync.service';
import { AgenteBigqueryUser } from './interfaces/agente-bigquery-user.interface';

describe('AgentesSyncService', () => {
  let service: AgentesSyncService;
  let usersRepository: UsersRepository;
  let mailHistoryService: MailHistoryService;
  let agentesBigqueryRepository: AgentesBigqueryRepository;
  let settingsService: SettingsService;

  beforeEach(async () => {
    global.__localTzOffset = 0;

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
            findUserRelationship: jest.fn(),
            createUserRelationship: jest.fn(),
          },
        },
        {
          provide: MailHistoryService,
          useValue: {
            generateHash: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getOneBySettingData: jest.fn(),
            upsertBySettingData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AgentesSyncService>(AgentesSyncService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
    agentesBigqueryRepository = module.get<AgentesBigqueryRepository>(AgentesBigqueryRepository);
    settingsService = module.get<SettingsService>(SettingsService);
  });

  it('creates association and agent users, creates the relationship, and queues invite for the new agent', async () => {
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
      datetime_ultima_atualizacao: '2026-07-21T12:00:00.000Z',
    };

    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    jest.spyOn(usersRepository, 'findUserRelationship').mockResolvedValue(null);
    jest
      .spyOn(usersRepository, 'create')
      .mockResolvedValueOnce({ id: 10 } as User)
      .mockResolvedValueOnce({ id: 20 } as User);
    jest.spyOn(mailHistoryService, 'generateHash').mockResolvedValue('generated-hash');

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
        role: expect.objectContaining({ id: RoleEnum.agentes }),
        status: expect.objectContaining({ id: StatusEnum.register }),
      }),
    );
    expect(usersRepository.createUserRelationship).toHaveBeenCalledWith(20, 10);
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

  it('creates an agent with a synthetic email when the BigQuery row email is null and queues invite', async () => {
    const row: AgenteBigqueryUser = {
      numero_identificacao: '600',
      nome: 'Marcia Marques',
      email: null,
      telefone: '21996428346',
      documento: '00036241709',
      tipo_documento: 'CPF',
      cnpj: '42498733000148',
      razao_social: 'MUNICIPIO DE RIO DE JANEIRO',
      nome_fantasia: 'RIO DE JANEIRO GABINETE DO PREFEITO',
      datetime_ultima_atualizacao: '2026-07-21T12:00:00.000Z',
    };

    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    jest.spyOn(usersRepository, 'findUserRelationship').mockResolvedValue(null);
    jest
      .spyOn(usersRepository, 'create')
      .mockResolvedValueOnce({ id: 10 } as User)
      .mockResolvedValueOnce({ id: 20 } as User);
    jest.spyOn(mailHistoryService, 'generateHash').mockResolvedValue('generated-hash');

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
      2,
      expect.objectContaining({
        email: 'marcia.00036241709@example.com',
        fullName: 'MARCIA MARQUES',
        cpfCnpj: '00036241709',
        role: expect.objectContaining({ id: RoleEnum.agentes }),
      }),
    );
    expect(mailHistoryService.generateHash).toHaveBeenCalled();
    expect(mailHistoryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 20 },
        email: 'marcia.00036241709@example.com',
        hash: 'generated-hash',
        inviteStatus: { id: InviteStatusEnum.queued },
      }),
      'AgentesSyncService.syncWeeklyAgentUsers()',
    );
  });

  it('uses the normalized cpf in place of first name when generating a synthetic email for blank names', async () => {
    const row: AgenteBigqueryUser = {
      numero_identificacao: '600',
      nome: '   ',
      email: null,
      telefone: '21996428346',
      documento: '00036241709',
      tipo_documento: 'CPF',
      cnpj: '42498733000148',
      razao_social: 'MUNICIPIO DE RIO DE JANEIRO',
      nome_fantasia: 'RIO DE JANEIRO GABINETE DO PREFEITO',
      datetime_ultima_atualizacao: '2026-07-22T12:00:00.000Z',
    };

    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    jest.spyOn(usersRepository, 'findUserRelationship').mockResolvedValue(null);
    jest
      .spyOn(usersRepository, 'create')
      .mockResolvedValueOnce({ id: 10 } as User)
      .mockResolvedValueOnce({ id: 20 } as User);
    jest.spyOn(mailHistoryService, 'generateHash').mockResolvedValue('generated-hash');

    await service.syncWeeklyAgentUsers([row]);

    expect(usersRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        email: '00036241709.00036241709@example.com',
        cpfCnpj: '00036241709',
      }),
    );
    expect(mailHistoryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: '00036241709.00036241709@example.com',
      }),
      'AgentesSyncService.syncWeeklyAgentUsers()',
    );
  });

  it('skips duplicate association, duplicate agent, and duplicate relationship', async () => {
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
      datetime_ultima_atualizacao: '2026-07-21T12:00:00.000Z',
    };

    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([{ id: 10 } as User])
      .mockResolvedValueOnce([{ id: 20 } as User]);
    jest.spyOn(usersRepository, 'findUserRelationship').mockResolvedValue({ userId: 20, relatedUserId: 10 } as any);

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
    expect(usersRepository.createUserRelationship).not.toHaveBeenCalled();
    expect(mailHistoryService.create).not.toHaveBeenCalled();
  });

  it('creates only the missing relationship when both users already exist', async () => {
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
      datetime_ultima_atualizacao: '2026-07-21T12:00:00.000Z',
    };

    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest
      .spyOn(usersRepository, 'findManyByNormalizedCpf')
      .mockResolvedValueOnce([{ id: 10 } as User])
      .mockResolvedValueOnce([{ id: 20 } as User]);
    jest.spyOn(usersRepository, 'findUserRelationship').mockResolvedValue(null);

    await service.syncWeeklyAgentUsers([row]);

    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(usersRepository.createUserRelationship).toHaveBeenCalledWith(20, 10);
  });

  it('reads the last sync cursor, queries incrementally, and advances it to the highest processed timestamp', async () => {
    const rows: AgenteBigqueryUser[] = [
      {
        numero_identificacao: '600',
        nome: 'Marcia Marques',
        email: 'marques.mcc@gmail.com',
        telefone: '21996428346',
        documento: '00036241709',
        tipo_documento: 'CPF',
        cnpj: '42498733000148',
        razao_social: 'MUNICIPIO DE RIO DE JANEIRO',
        nome_fantasia: 'RIO DE JANEIRO GABINETE DO PREFEITO',
        datetime_ultima_atualizacao: '2026-07-21T12:00:00.000Z',
      },
      {
        numero_identificacao: '601',
        nome: 'Julia Souza',
        email: 'julia@example.com',
        telefone: '21996420000',
        documento: '98765432100',
        tipo_documento: 'CPF',
        cnpj: '11111111000199',
        razao_social: 'AUTARQUIA RIO',
        nome_fantasia: 'AUTARQUIA RIO',
        datetime_ultima_atualizacao: '2026-07-21T13:00:00.000Z',
      },
    ];

    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest.spyOn(agentesBigqueryRepository, 'findUsersToSync').mockResolvedValue(rows);
    jest.spyOn(usersRepository, 'findManyByNormalizedCpf').mockResolvedValue([]);
    jest.spyOn(usersRepository, 'findUserRelationship').mockResolvedValue(null);
    jest
      .spyOn(usersRepository, 'create')
      .mockResolvedValueOnce({ id: 10 } as User)
      .mockResolvedValueOnce({ id: 20 } as User)
      .mockResolvedValueOnce({ id: 30 } as User)
      .mockResolvedValueOnce({ id: 40 } as User);
    jest.spyOn(mailHistoryService, 'generateHash').mockResolvedValue('generated-hash');

    await service.syncWeeklyAgentUsers();

    expect(settingsService.getOneBySettingData).toHaveBeenCalledWith(
      appSettings.any__agentes_sync_last_execution,
      true,
      'syncWeeklyAgentUsers',
    );
    expect(agentesBigqueryRepository.findUsersToSync).toHaveBeenCalledWith('2026-07-20T00:00:00.000Z');
    expect(settingsService.upsertBySettingData).toHaveBeenCalledWith(
      appSettings.any__agentes_sync_last_execution,
      '2026-07-21T13:00:00.000Z',
    );
  });

  it('does not advance the cursor when the incremental query returns no rows', async () => {
    jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValue({
      getValueAsString: () => '2026-07-20T00:00:00.000Z',
    } as any);
    jest.spyOn(agentesBigqueryRepository, 'findUsersToSync').mockResolvedValue([]);

    const result = await service.syncWeeklyAgentUsers();

    expect(result.processedRows).toBe(0);
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalled();
  });
});
