import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryOrdemPagamentoService } from './bigquery-ordem-pagamento.service';
import { BigqueryOrdemPagamentoRepository } from '../repositories/bigquery-ordem-pagamento.repository';
import { BigqueryOrdemPagamentoDTO } from '../dtos/bigquery-ordem-pagamento.dto';

function getMockData() {
  const mockData: BigqueryOrdemPagamentoDTO[] = [
    {
      id: 1,
      dataOrdem: '2024-11-15',
      dataPagamento: '2024-11-20',
      idConsorcio: '1',
      consorcio: 'Consorcio1',
      idOperadora: '1',
      operadora: 'Operadora1',
      servico: 'Servico1',
      idOrdemPagamento: '1',
      idOrdemRessarcimento: '2',
      quantidadeTransacaoDebito: 10,
      valorDebito: 500,
      quantidadeTransacaoEspecie: 5,
      valorEspecie: 200,
      quantidadeTransacaoGratuidade: 2,
      valorGratuidade: 0,
      quantidadeTransacaoIntegracao: 3,
      valorIntegracao: 150,
      quantidadeTransacaoRateioCredito: 1,
      valorRateioCredito: 50,
      quantidadeTransacaoRateioDebito: 1,
      valorRateioDebito: 30,
      quantidadeTotalTransacao: 22,
      valorTotalTransacaoBruto: 930,
      valorDescontoTaxa: 30,
      valorTotalTransacaoLiquido: 900,
      quantidadeTotalTransacaoCaptura: 22,
      valorTotalTransacaoCaptura: 930,
      indicadorOrdemValida: true,
      versao: '1.0',
      operadoraTipoDocumento: 'CPF',
      operadoraCpfCnpj: '12345678901',
      consorcioCnpj: '12345678000199',
      tipoFavorecido: null,
      datetimeUltimaAtualizacao: new Date('2024-11-15T00:00:00Z'),
      dataCaptura: new Date('2024-11-15T00:00:00Z')
    },
  ];
  return mockData;
}

describe('BigqueryOrdemPagamentoService', () => {
  let service: BigqueryOrdemPagamentoService;
  let repository: BigqueryOrdemPagamentoRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BigqueryOrdemPagamentoService,
        {
          provide: BigqueryOrdemPagamentoRepository,
          useValue: {
            findMany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BigqueryOrdemPagamentoService>(BigqueryOrdemPagamentoService);
    repository = module.get<BigqueryOrdemPagamentoRepository>(BigqueryOrdemPagamentoRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get data from the specified date range', async () => {
    const dataCapturaInicial = new Date('2024-11-15');
    const dataCapturaFinal = new Date('2024-11-21');
    const mockData = getMockData();
    jest.spyOn(repository, 'findMany').mockResolvedValue(mockData);

    const result = await service.getFromWeek(dataCapturaInicial, dataCapturaFinal);

    expect(result).toEqual(mockData);
    expect(repository.findMany).toHaveBeenCalledWith({
      startDate: dataCapturaInicial,
      endDate: dataCapturaFinal,
    });
  });

  it('should apply the filter when provided', async () => {
    const dataCapturaInicial = new Date('2024-11-15');
    const dataCapturaFinal = new Date('2024-11-21');
    const filter = { consorcioName: ['Consorcio1'] };
    const mockData: BigqueryOrdemPagamentoDTO[] = getMockData();
    jest.spyOn(repository, 'findMany').mockResolvedValue(mockData);

    const result = await service.getFromWeek(dataCapturaInicial, dataCapturaFinal, 0, filter);

    expect(result).toEqual(mockData);
    expect(repository.findMany).toHaveBeenCalledWith({
      startDate: dataCapturaInicial,
      endDate: dataCapturaFinal,
      ...filter,
    });
  });
});