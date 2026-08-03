import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AntifraudService } from './antifraud.service';
import {
  OrdemPagamentoRepository,
  SuspiciousOrdemPagamento,
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntifraudService,
        {
          provide: OrdemPagamentoRepository,
          useValue: {
            findSuspiciousOrdersCreatedBetween: jest.fn(),
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
    ordemPagamentoRepository = module.get<OrdemPagamentoRepository>(
      OrdemPagamentoRepository,
    );
    mailService = module.get<MailService>(MailService);
    settingsService = module.get<SettingsService>(SettingsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('sends the antifraud email when suspicious orders are found', async () => {
    jest
      .spyOn(settingsService, 'getOneBySettingData')
      .mockImplementation(async (setting) => {
        if (setting.name === appSettings.any__mail_admin_fraud_enabled.name) {
          return {
            value: 'true',
            getValueAsBoolean: () => true,
          } as any;
        }
        if (setting.name === appSettings.any__mail_admin_fraud_threshold.name) {
          return { value: '15000' } as any;
        }
        if (
          setting.name ===
          appSettings.any__mail_admin_fraud_last_execution.name
        ) {
          return { value: '2025-01-01T00:00:00.000Z' } as any;
        }
        throw new Error(`Unexpected setting ${setting.name}`);
      });
    jest
      .spyOn(settingsService, 'findManyBySettingDataGroup')
      .mockResolvedValue([
        {
          getValueAsString: () => 'matthew.araujo@prefeitura.rio',
        } as any,
      ]);

    const suspiciousOrders: SuspiciousOrdemPagamento[] = [
      {
        id: 1,
        idOrdemPagamento: 'OP-1',
        nomeConsorcio: 'STPC',
        nomeOperadora: 'Operadora Teste',
        valor: 20000,
        dataOrdem: new Date('2025-01-05'),
        dataCaptura: new Date('2025-01-05T10:00:00.000Z'),
        createdAt: new Date('2025-01-06T12:00:00.000Z'),
      },
    ];

    jest
      .spyOn(ordemPagamentoRepository, 'findSuspiciousOrdersCreatedBetween')
      .mockResolvedValue(suspiciousOrders);
    jest.spyOn(mailService, 'sendAdminFraudAlert').mockResolvedValue({
      success: true,
      response: {
        code: 250,
        message: 'ok',
      },
    } as any);

    await service.runAdminFraudAlertJob();

    expect(
      ordemPagamentoRepository.findSuspiciousOrdersCreatedBetween,
    ).toHaveBeenCalled();
    expect(mailService.sendAdminFraudAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['matthew.araujo@prefeitura.rio'],
      }),
    );
    const [{ data: mailPayload }] = jest.mocked(mailService.sendAdminFraudAlert)
      .mock.calls[0];
    expect(mailPayload.generatedAtDate).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(mailPayload.generatedAtTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(mailPayload.threshold).toContain('15.000,00');
    expect(mailPayload.orders).toEqual([
      expect.objectContaining({
        dataOrdem: '05-01-2025',
        dataCapturaDate: '05-01-2025',
        dataCapturaTime: '10:00:00',
        createdAtDate: '06-01-2025',
        createdAtTime: '12:00:00',
      }),
    ]);
    expect(settingsService.upsertBySettingData).toHaveBeenCalledWith(
      appSettings.any__mail_admin_fraud_last_execution,
      expect.any(String),
    );
  });

  it('updates the checkpoint without sending email when no suspicious orders are found', async () => {
    jest
      .spyOn(settingsService, 'getOneBySettingData')
      .mockImplementation(async (setting) => {
        if (setting.name === appSettings.any__mail_admin_fraud_enabled.name) {
          return {
            value: 'true',
            getValueAsBoolean: () => true,
          } as any;
        }
        if (setting.name === appSettings.any__mail_admin_fraud_threshold.name) {
          return { value: '15000' } as any;
        }
        if (
          setting.name ===
          appSettings.any__mail_admin_fraud_last_execution.name
        ) {
          return { value: '2025-01-01T00:00:00.000Z' } as any;
        }
        throw new Error(`Unexpected setting ${setting.name}`);
      });
    jest
      .spyOn(settingsService, 'findManyBySettingDataGroup')
      .mockResolvedValue([
        {
          getValueAsString: () => 'matthew.araujo@prefeitura.rio',
        } as any,
      ]);
    jest
      .spyOn(ordemPagamentoRepository, 'findSuspiciousOrdersCreatedBetween')
      .mockResolvedValue([]);

    await service.runAdminFraudAlertJob();

    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).toHaveBeenCalledWith(
      appSettings.any__mail_admin_fraud_last_execution,
      expect.any(String),
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

    jest
      .spyOn(settingsService, 'getOneBySettingData')
      .mockImplementation(async (setting) => {
        if (setting.name === appSettings.any__mail_admin_fraud_enabled.name) {
          return {
            value: 'true',
            getValueAsBoolean: () => true,
          } as any;
        }
        if (setting.name === appSettings.any__mail_admin_fraud_threshold.name) {
          return { value: '15000' } as any;
        }
        if (
          setting.name ===
          appSettings.any__mail_admin_fraud_last_execution.name
        ) {
          return { value: '2025-01-01T00:00:00.000Z' } as any;
        }
        throw new Error(`Unexpected setting ${setting.name}`);
      });
    jest
      .spyOn(settingsService, 'findManyBySettingDataGroup')
      .mockResolvedValue([
        {
          getValueAsString: () => 'matthew.araujo@prefeitura.rio',
        } as any,
      ]);
    jest
      .spyOn(ordemPagamentoRepository, 'findSuspiciousOrdersCreatedBetween')
      .mockResolvedValue([
        {
          id: 1,
          idOrdemPagamento: 'OP-1',
          nomeConsorcio: 'STPC',
          nomeOperadora: 'Operadora Teste',
          valor: 20000,
          dataOrdem: new Date('2025-01-05'),
          dataCaptura: new Date('2025-01-05T10:00:00.000Z'),
          createdAt: new Date('2025-01-06T12:00:00.000Z'),
        },
      ] as SuspiciousOrdemPagamento[]);

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    await service.runAdminFraudAlertJob();

    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalledWith(
      appSettings.any__mail_admin_fraud_last_execution,
      expect.any(String),
    );
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('skips the job when antifraud recipients are missing from the database', async () => {
    jest
      .spyOn(settingsService, 'getOneBySettingData')
      .mockImplementation(async (setting) => {
        if (setting.name === appSettings.any__mail_admin_fraud_enabled.name) {
          return {
            value: 'true',
            getValueAsBoolean: () => true,
          } as any;
        }
        throw new Error(`Unexpected setting ${setting.name}`);
      });
    jest
      .spyOn(settingsService, 'findManyBySettingDataGroup')
      .mockResolvedValue([]);

    await service.runAdminFraudAlertJob();

    expect(
      ordemPagamentoRepository.findSuspiciousOrdersCreatedBetween,
    ).not.toHaveBeenCalled();
    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalled();
  });

  it('skips the job when antifraud recipients still use the legacy placeholder', async () => {
    jest
      .spyOn(settingsService, 'getOneBySettingData')
      .mockImplementation(async (setting) => {
        if (setting.name === appSettings.any__mail_admin_fraud_enabled.name) {
          return {
            value: 'true',
            getValueAsBoolean: () => true,
          } as any;
        }
        throw new Error(`Unexpected setting ${setting.name}`);
      });
    jest
      .spyOn(settingsService, 'findManyBySettingDataGroup')
      .mockResolvedValue([
        {
          getValueAsString: () => 'admin_fraud@example.com',
        } as any,
      ]);

    await service.runAdminFraudAlertJob();

    expect(
      ordemPagamentoRepository.findSuspiciousOrdersCreatedBetween,
    ).not.toHaveBeenCalled();
    expect(mailService.sendAdminFraudAlert).not.toHaveBeenCalled();
    expect(settingsService.upsertBySettingData).not.toHaveBeenCalled();
  });
});
