import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AntifraudService } from './antifraud.service';
import {
  FavorecidoAcimaDoLimite,
  OrdemPagamentoRepository,
} from 'src/cnab/novo-remessa/repository/ordem-pagamento.repository';
import { MailService } from 'src/mail/mail.service';
import { SettingsService } from 'src/settings/settings.service';
import { appSettings } from 'src/settings/app.settings';

describe('AntifraudService', () => {
  let service: AntifraudService;
  let ordemPagamentoRepository: OrdemPagamentoRepository;
  let mailService: MailService;
  let settingsService: SettingsService;
  let configService: ConfigService;

  // Monday 23:00 UTC: the alert closes the Friday–Monday cycle paid on Tuesday.
  const MONDAY_ALERT = new Date('2026-11-23T23:00:00.000Z');

  const favorecido: FavorecidoAcimaDoLimite = {
    userId: 1426,
    nomeOperadora: 'Operadora Teste',
    nomeConsorcio: 'STPL',
    quantidadeOrdens: 4,
    valorTotal: 22122.5,
    primeiraCaptura: new Date('2026-11-21T10:00:00.000Z'),
    ultimaCaptura: new Date('2026-11-23T10:00:00.000Z'),
    ordens: [
      { id: 1069151, idOrdemPagamento: 'OP-A', dataOrdem: '2026-11-20', dataCaptura: '2026-11-21T10:00:00Z', valor: 4895 },
      { id: 1070841, idOrdemPagamento: 'OP-B', dataOrdem: '2026-11-21', dataCaptura: '2026-11-21T10:00:00Z', valor: 5877.5 },
      { id: 1072147, idOrdemPagamento: 'OP-C', dataOrdem: '2026-11-22', dataCaptura: '2026-11-22T10:00:00Z', valor: 5675 },
      { id: 1073861, idOrdemPagamento: null, dataOrdem: '2026-11-23', dataCaptura: '2026-11-23T10:00:00Z', valor: 5675 },
    ],
  };

  const mockEnabledSettings = () => {
    jest
      .spyOn(settingsService, 'getOneBySettingData')
      .mockImplementation((setting) => {
        if (setting.name === appSettings.any__mail_admin_fraud_enabled.name) {
          return Promise.resolve({
            value: 'true',
            getValueAsBoolean: () => true,
          } as any);
        }
        if (setting.name === appSettings.any__mail_admin_fraud_threshold.name) {
          return Promise.resolve({ value: '15000' } as any);
        }
        return Promise.reject(new Error(`Unexpected setting ${setting.name}`));
      });
  };

  const mockRecipients = (email = 'matthew.araujo@prefeitura.rio') => {
    jest
      .spyOn(settingsService, 'findManyBySettingDataGroup')
      .mockResolvedValue([{ getValueAsString: () => email } as any]);
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: MONDAY_ALERT, doNotFake: ['nextTick', 'setImmediate'] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntifraudService,
        {
          provide: OrdemPagamentoRepository,
          useValue: {
            findFavorecidosAcimaDoLimiteNoCiclo: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendAdminFraudAlert: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getOneBySettingData: jest.fn(),
            findManyBySettingDataGroup: jest.fn(),
            upsertBySettingData: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.nodeEnv') {
                return 'production';
              }
              if (key === 'app.backendDomain') {
                return 'https://api.example.com';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AntifraudService>(AntifraudService);
    ordemPagamentoRepository = module.get<OrdemPagamentoRepository>(OrdemPagamentoRepository);
    mailService = module.get<MailService>(MailService);
    settingsService = module.get<SettingsService>(SettingsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('looks up the favorecidos of the current payment cycle (Friday–Monday on a Monday run)', async () => {
    mockEnabledSettings();
    mockRecipients();
    jest.spyOn(ordemPagamentoRepository, 'findFavorecidosAcimaDoLimiteNoCiclo').mockResolvedValue([]);

    await service.runAdminFraudAlertJob();

    expect(ordemPagamentoRepository.findFavorecidosAcimaDoLimiteNoCiclo).toHaveBeenCalledWith(
      '2026-11-20',
      '2026-11-23',
      15000,
      ['STPC', 'STPL', 'TEC'],
    );
  });

  it('uses the Tuesday–Thursday cycle on a Thursday run', async () => {
    jest.setSystemTime(new Date('2026-11-26T23:00:00.000Z'));
    mockEnabledSettings();
    mockRecipients();
    jest.spyOn(ordemPagamentoRepository, 'findFavorecidosAcimaDoLimiteNoCiclo').mockResolvedValue([]);

    await service.runAdminFraudAlertJob();

    expect(ordemPagamentoRepository.findFavorecidosAcimaDoLimiteNoCiclo).toHaveBeenCalledWith(
      '2026-11-24',
      '2026-11-26',
      15000,
      ['STPC', 'STPL', 'TEC'],
    );
  });

  it('sends one row per favorecido whose cycle total is above the threshold', async () => {
    mockEnabledSettings();
    mockRecipients();
    jest.spyOn(ordemPagamentoRepository, 'findFavorecidosAcimaDoLimiteNoCiclo').mockResolvedValue([favorecido]);
    jest.spyOn(mailService, 'sendAdminFraudAlert').mockResolvedValue({
      success: true,
      response: { code: 250, message: 'ok' },
    } as any);

    await service.runAdminFraudAlertJob();

    expect(mailService.sendAdminFraudAlert).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['matthew.araujo@prefeitura.rio'] }),
    );
    const [{ data: mailPayload }] = jest.mocked(mailService.sendAdminFraudAlert).mock.calls[0];
    expect(mailPayload.generatedAtDate).toBe('23-11-2026');
    expect(mailPayload.generatedAtTime).toBe('23:00:00');
    expect(mailPayload.threshold).toContain('15.000,00');
    expect(mailPayload.cicloInicio).toBe('20-11-2026');
    expect(mailPayload.cicloFim).toBe('23-11-2026');
    expect(mailPayload.dataPagamento).toBe('24-11-2026');
    expect(mailPayload.totalOrders).toBe(1);
    expect(mailPayload.totalValue).toContain('22.122,50');
    expect(mailPayload.orders).toEqual([
      {
        userId: 1426,
        nomeOperadora: 'Operadora Teste',
        nomeConsorcio: 'STPL',
        quantidadeOrdens: 4,
        valor: expect.stringContaining('22.122,50'),
        primeiraCaptura: '21-11-2026',
        ultimaCaptura: '23-11-2026',
        ordens: [
          { id: 1069151, idOrdemPagamento: 'OP-A', dataOrdem: '20-11-2026', dataCaptura: '21-11-2026', valor: expect.stringContaining('4.895,00') },
          { id: 1070841, idOrdemPagamento: 'OP-B', dataOrdem: '21-11-2026', dataCaptura: '21-11-2026', valor: expect.stringContaining('5.877,50') },
          { id: 1072147, idOrdemPagamento: 'OP-C', dataOrdem: '22-11-2026', dataCaptura: '22-11-2026', valor: expect.stringContaining('5.675,00') },
          { id: 1073861, idOrdemPagamento: '-', dataOrdem: '23-11-2026', dataCaptura: '23-11-2026', valor: expect.stringContaining('5.675,00') },
        ],
      },
    ]);
    expect(settingsService.upsertBySettingData).toHaveBeenCalledWith(
      appSettings.any__mail_admin_fraud_last_execution,
      MONDAY_ALERT.toISOString(),
    );
  });

  it('records the execution without sending email when no favorecido is above the threshold', async () => {
    mockEnabledSettings();
    mockRecipients();
    jest.spyOn(ordemPagamentoRepository, 'findFavorecidosAcimaDoLimiteNoCiclo').mockResolvedValue([]);

    await service.runAdminFraudAlertJob();

    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).toHaveBeenCalledWith(
      appSettings.any__mail_admin_fraud_last_execution,
      MONDAY_ALERT.toISOString(),
    );
  });

  it('prints the payload and skips email send in local environments', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'app.nodeEnv') {
        return 'local';
      }
      if (key === 'app.backendDomain') {
        return 'http://localhost:3000';
      }
      return undefined;
    });
    mockEnabledSettings();
    mockRecipients();
    jest.spyOn(ordemPagamentoRepository, 'findFavorecidosAcimaDoLimiteNoCiclo').mockResolvedValue([favorecido]);
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    await service.runAdminFraudAlertJob();

    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('skips the job when antifraud recipients are missing from the database', async () => {
    mockEnabledSettings();
    jest.spyOn(settingsService, 'findManyBySettingDataGroup').mockResolvedValue([]);

    await service.runAdminFraudAlertJob();

    expect(ordemPagamentoRepository.findFavorecidosAcimaDoLimiteNoCiclo).not.toHaveBeenCalled();
    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalled();
  });

  it('skips the job when antifraud recipients still use the legacy placeholder', async () => {
    mockEnabledSettings();
    mockRecipients('admin_fraud@example.com');

    await service.runAdminFraudAlertJob();

    expect(ordemPagamentoRepository.findFavorecidosAcimaDoLimiteNoCiclo).not.toHaveBeenCalled();
    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalled();
  });
});
