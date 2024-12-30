import { OrdemPagamentoService } from './ordem-pagamento.service';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryOrdemPagamentoService } from '../../../bigquery/services/bigquery-ordem-pagamento.service';
import { UsersService } from '../../../users/users.service';
import { CustomLogger } from '../../../utils/custom-logger';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';
import { nextFriday } from 'date-fns';
import { getStatusRemessaEnumByValue, StatusRemessaEnum } from '../../enums/novo-remessa/status-remessa.enum';
import { getCodigoOcorrenciaEnumByValue, OcorrenciaEnum } from '../../enums/ocorrencia.enum';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';

describe('OrdemPagamentoService', () => {
  let service: OrdemPagamentoService;
  let ordemPagamentoRepository: OrdemPagamentoRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdemPagamentoService,
        {
          provide: OrdemPagamentoRepository,
          useValue: {
            findOrdensPagamentoAgrupadasPorMes: jest.fn(),
            findOrdensPagamentoByOrdemPagamentoAgrupadoId: jest.fn(),
          },
        },
        {
          provide: BigqueryOrdemPagamentoService,
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: CustomLogger,
          useValue: {
            debug: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdemPagamentoService>(OrdemPagamentoService);
    ordemPagamentoRepository = module.get<OrdemPagamentoRepository>(OrdemPagamentoRepository);
  });

  describe('findOrdensPagamentoAgrupadasPorMes', () => {
    it('should return an array of OrdemPagamentoAgrupadoMensalDto', async () => {
      const userId = 1;
      const yearMonth = new Date();
      const expectedResult: OrdemPagamentoAgrupadoMensalDto[] = [
        {
          valorTotal: 100,
          data: nextFriday(new Date()),
          statusRemessa: StatusRemessaEnum.AguardandoPagamento,
          motivoStatusRemessa: OcorrenciaEnum.AA,
          descricaoMotivoStatusRemessa: getCodigoOcorrenciaEnumByValue(OcorrenciaEnum['00']),
          descricaoStatusRemessa: getStatusRemessaEnumByValue(StatusRemessaEnum.AguardandoPagamento),
        },
      ];

      jest.spyOn(ordemPagamentoRepository, 'findOrdensPagamentoAgrupadasPorMes').mockResolvedValue(expectedResult);

      const result = await service.findOrdensPagamentoAgrupadasPorMes(userId, yearMonth);

      expect(result).toEqual(expectedResult);
      expect(ordemPagamentoRepository.findOrdensPagamentoAgrupadasPorMes).toHaveBeenCalledWith(userId, yearMonth);
    });
  });


  describe('findOrdensPagamentoByOrdemPagamentoAgrupadoId', () => {
    it('should return an array of OrdemPagamentoDiarioDto', async () => {
      const ordemPagamentoAgrupadoId = 1;
      const expectedResult: OrdemPagamentoSemanalDto[] = [
        {
          valor: 100,
          dataOrdem: new Date(),
          dataReferencia: new Date(),
          statusRemessa: 'AguardandoPagamento',
          motivoStatusRemessa: 'AA',
        },
      ];

      jest.spyOn(ordemPagamentoRepository, 'findOrdensPagamentoByOrdemPagamentoAgrupadoId').mockResolvedValue(expectedResult);

      const result = await service.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId);

      expect(result).toEqual(expectedResult);
      expect(ordemPagamentoRepository.findOrdensPagamentoByOrdemPagamentoAgrupadoId).toHaveBeenCalledWith(ordemPagamentoAgrupadoId);
    });
  });
});