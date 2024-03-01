import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryService } from 'src/bigquery/bigquery.service';
import { SettingsService } from 'src/settings/settings.service';
import { BigqueryTransacaoRepository } from './bigquery-transacao.repository';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { config } from 'dotenv';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingEntity } from 'src/settings/entities/setting.entity';

describe('BigqueryTransacaoRepository', () => {
  let settingsService: SettingsService;
  let bqTransacaoRepository: BigqueryTransacaoRepository;
  const mockBqGoogleCredentials = () => ({
    'google.clientApiType': process.env.GOOGLE_CLIENT_API_TYPE,
    'google.clientApiProjectId': process.env.GOOGLE_CLIENT_API_PROJECT_ID,
    'google.clientApiPrivateKeyId':
      process.env.GOOGLE_CLIENT_API_PRIVATE_KEY_ID,
    'google.clientApiPrivateKey': process.env.GOOGLE_CLIENT_API_PRIVATE_KEY,
    'google.clientApiClientEmail': process.env.GOOGLE_CLIENT_API_CLIENT_EMAIL,
    'google.clientApiClientId': process.env.GOOGLE_CLIENT_API_CLIENT_ID,
    'google.clientApiAuthUri': process.env.GOOGLE_CLIENT_API_AUTH_URI,
    'google.clientApiTokenUri': process.env.GOOGLE_CLIENT_API_TOKEN_URI,
    'google.clientApiAuthProviderX509CertUrl':
      process.env.GOOGLE_CLIENT_API_AUTH_PROVIDER_X509_CERT_URL,
    'google.clientApiClientX509CertUrl':
      process.env.GOOGLE_CLIENT_API_CLIENT_X509_CERT_URL,
    'google.clientApiUniverseDomain':
      process.env.GOOGLE_CLIENT_API_UNIVERSE_DOMAIN,
  });

  beforeAll(() => {
    const envPath = resolve(__dirname, '../../../.env');
    config({ path: envPath });
  });

  beforeEach(async () => {
    const settingsServiceMock = {
      provide: SettingsService,
      useValue: {
        getOneBySettingData: jest.fn(),
      },
    } as Provider;
    const configServiceMock = {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn((key: string) => mockBqGoogleCredentials()[key]),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BigqueryService,
        BigqueryTransacaoRepository,
        settingsServiceMock,
        configServiceMock,
      ],
    }).compile();

    settingsService = module.get(SettingsService);
    bqTransacaoRepository = module.get(BigqueryTransacaoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(settingsService).toBeDefined();
  });

  describe('findTransacaoBy', () => {
    it('should return some data', async () => {
      // Arrange
      jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValueOnce({
        getValueAsString: () => BigqueryEnvironment.Development,
      } as SettingEntity);

      // Act
      const result = await bqTransacaoRepository.findTransacaoBy({
        startDate: new Date('2023-06-01'),
        endDate: new Date('2024-06-01'),
        limit: 50,
      });

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
