import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryTransacaoService } from './bigquery-transacao.service';
import { BigqueryTransacaoRepository } from '../repositories/bigquery-transacao.repository';
import { BigqueryTransacao } from '../entities/transacao.bigquery-entity';
import { Role } from '../../roles/entities/role.entity';

describe('BigqueryTransacaoService', () => {
  let service: BigqueryTransacaoService;
  let repository: BigqueryTransacaoRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BigqueryTransacaoService,
        {
          provide: BigqueryTransacaoRepository,
          useValue: {
            findManyByOrdemPagamentoId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BigqueryTransacaoService>(BigqueryTransacaoService);
    repository = module.get<BigqueryTransacaoRepository>(BigqueryTransacaoRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return transactions by ordemPagamentoId', async () => {
    const ordemPagamentoId = 1;
    const mockData: BigqueryTransacao[] = [
      {
        id: 1,
        data: '2024-11-15',
        hora: 10,
        datetime_transacao: '2024-11-15T10:00:00Z',
        datetime_processamento: '2024-11-15T10:05:00Z',
        datetime_captura: '2024-11-15T10:10:00Z',
        modo: 'online',
        id_consorcio: '1',
        consorcio: 'Consorcio1',
        id_operadora: '1',
        operadoraCpfCnpj: '12345678901',
        consorcioCnpj: '12345678000199',
        operadora: 'Operadora1',
        servico: 'Servico1',
        sentido: 'Norte',
        id_veiculo: 1,
        id_cliente: '1',
        id_transacao: '1',
        tipo_pagamento: 'debito',
        tipo_transacao: 'compra',
        tipo_gratuidade: null,
        tipo_integracao: null,
        id_integracao: null,
        latitude: null,
        longitude: null,
        stop_id: null,
        stop_lat: null,
        stop_lon: null,
        valor_transacao: 100,
        valor_pagamento: 100,
        versao: '1.0',
        id_ordem_pagamento: 1,
      },
    ];

    jest.spyOn(repository, 'findManyByOrdemPagamentoId').mockResolvedValue(mockData);

    const role = new Role();
    role.name = 'dummy';
    role.id = 1;
    const user = { user: { id: 1, role: role } };
    const result = await service.findByOrdemPagamentoId(ordemPagamentoId, '99999999999', { ...user } as any);

    expect(result).toEqual(mockData);
    expect(repository.findManyByOrdemPagamentoId).toHaveBeenCalledWith(ordemPagamentoId, '99999999999', false);
  });
});