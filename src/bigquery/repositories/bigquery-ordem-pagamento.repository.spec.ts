import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryService } from 'src/bigquery/bigquery.service';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingsService } from 'src/settings/settings.service';
import { testGetBigqueryCredentials, testLoadEnv } from 'src/test/test-utils';
import { BigqueryOrdemPagamentoRepository } from './bigquery-ordem-pagamento.repository';

describe('BigqueryOrdemPagamentoRepository', () => {
  let settingsService: SettingsService;
  let bqOrdemPagamentoRepository: BigqueryOrdemPagamentoRepository;
  let googleCredentials: any;

  beforeAll(() => {
    testLoadEnv();
  });

  beforeEach(async () => {
    googleCredentials = testGetBigqueryCredentials();
    const settingsServiceMock = {
      provide: SettingsService,
      useValue: {
        getOneBySettingData: jest.fn(),
      },
    } as Provider;
    const configServiceMock = {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn((key: string) => googleCredentials[key]),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BigqueryService,
        BigqueryOrdemPagamentoRepository,
        settingsServiceMock,
        configServiceMock,
      ],
    }).compile();

    settingsService = module.get(SettingsService);
    bqOrdemPagamentoRepository = module.get(BigqueryOrdemPagamentoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(settingsService).toBeDefined();
  });

  // describe('findMany', () => {
  //   it('should return some data', async () => {
  //     // Arrange
  //     jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValueOnce({
  //       getValueAsString: () => BigqueryEnvironment.Production,
  //     } as SettingEntity);

  //     // Act
  //     const result = await bqOrdemPagamentoRepository.findMany({
  //       startDate: new Date('2023-05-02'),
  //       endDate: new Date('2024-05-08'),
  //       ignoreTransacaoLiquidoZero: true,
  //       limit: 50,
  //     });

  //     // Assert
  //     expect(result.length).toBeGreaterThan(0);
  //   });
  // });

  describe('query', () => {
    it('should return query data', async () => {
      // Arrange
      jest.spyOn(settingsService, 'getOneBySettingData').mockResolvedValueOnce({
        getValueAsString: () => BigqueryEnvironment.Production,
      } as SettingEntity);

      // Act
//       const operadora = await bqOrdemPagamentoRepository.query(
//         `
// SELECT t.modo, o.operadora, c.consorcio, c.cnpj, o.documento, t.id_consorcio, t.id_operadora
// FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t
// LEFT JOIN \`rj-smtr.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio
// LEFT JOIN \`rj-smtr.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora
// WHERE o.documento IN ('03818429405', '10204153719')
//         `,
//       );
      const consorcio = await bqOrdemPagamentoRepository.query(
        `
SELECT t.modo, c.consorcio, o.operadora, c.cnpj, o.documento, t.id_consorcio, t.id_operadora
FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t
LEFT JOIN \`rj-smtr.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio
LEFT JOIN \`rj-smtr.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora
LIMIT 10
        `,
      );
      const len = consorcio[0].length;

      // Assert
      expect(len).toBeDefined();
    });
  });
});
