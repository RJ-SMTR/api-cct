import { Test, TestingModule } from '@nestjs/testing';
import { OrdemPagamentoService } from './ordem-pagamento-agrupado.service';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { UsersService } from '../../../users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { StatusRemessaEnum } from '../../enums/novo-remessa/status-remessa.enum';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { AllPagadorDict } from '../../interfaces/pagamento/all-pagador-dict.interface';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { User } from '../../../users/entities/user.entity';
import { OrdensPagamentoAgrupadasDto } from '../dto/ordens-pagamento-agrupadas.dto';

describe('OrdemPagamentoService', () => {
  let service: OrdemPagamentoService;
  let ordemPagamentoRepository: OrdemPagamentoRepository;
  let ordemPagamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository;
  let ordemPagamentoAgrupadoHistoricoRepository: OrdemPagamentoAgrupadoHistoricoRepository;
  let pagadorService: PagadorService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdemPagamentoService,
        {
          provide: OrdemPagamentoRepository,
          useValue: {
            findOrdensPagamentoAgrupadas: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: OrdemPagamentoAgrupadoRepository,
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: OrdemPagamentoAgrupadoHistoricoRepository,
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: PagadorService,
          useValue: {
            getAllPagador: jest.fn(),
            findByConta: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getOne: jest.fn(),
          },
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
    ordemPagamentoAgrupadoRepository = module.get<OrdemPagamentoAgrupadoRepository>(OrdemPagamentoAgrupadoRepository);
    ordemPagamentoAgrupadoHistoricoRepository = module.get<OrdemPagamentoAgrupadoHistoricoRepository>(OrdemPagamentoAgrupadoHistoricoRepository);
    pagadorService = module.get<PagadorService>(PagadorService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('prepararPagamentoAgrupados', () => {
    it('should call saveAll if pagador is found', async () => {
      const dataOrdemInicial = new Date();
      const dataOrdemFinal = new Date();
      const dataPgto = new Date();
      const pagador = new Pagador();
      pagador.id = 1;
      pagador.agencia = '1234';
      pagador.conta = '123456';
      pagador.dvConta = '7';
      pagador.dvAgencia = '1';

      jest.spyOn(service, 'getPagador').mockResolvedValue(pagador);
      jest.spyOn(service, 'saveAll').mockResolvedValue();

      const pagadorKey: keyof AllPagadorDict = 'cett'; // Use a valid key from AllPagadorDict

      await service.prepararPagamentoAgrupados(dataOrdemInicial, dataOrdemFinal, dataPgto, pagadorKey);


      jest.spyOn(pagadorService, 'getAllPagador').mockResolvedValue({ cett: pagador, contaBilhetagem: pagador });
      jest.spyOn(pagadorService, 'findByConta').mockResolvedValue(pagador);

      expect(service.getPagador).toHaveBeenCalledWith(pagadorKey);
      expect(service.saveAll).toHaveBeenCalledWith(dataOrdemInicial, dataOrdemFinal, pagador, dataPgto);
    });

    it('should not call saveAll if pagador is not found', async () => {
      const dataOrdemInicial = new Date();
      const dataOrdemFinal = new Date();
      const dataPgto = new Date();
      const pagadorKey: keyof AllPagadorDict = 'cett'; // Use a valid key from AllPagadorDict

      jest.spyOn(service, 'getPagador').mockResolvedValue(null);
      jest.spyOn(service, 'saveAll').mockResolvedValue();

      await service.prepararPagamentoAgrupados(dataOrdemInicial, dataOrdemFinal, dataPgto, pagadorKey);

      expect(service.getPagador).toHaveBeenCalledWith(pagadorKey);
      expect(service.saveAll).not.toHaveBeenCalled();
    });
  });

  describe('buildHistoricoFromOrdemPagamentoAgrupado', () => {
    it('should build historico from ordemPagamentoAgrupado', async () => {
      const ordemPagamentoAgrupado = new OrdemPagamentoAgrupado();
      ordemPagamentoAgrupado.ordensPagamento = [
        new OrdemPagamento({
          userId: 1,
          valor: 100,
          idOperadora: "1",
          dataOrdem: new Date(),
          nomeConsorcio: "Consorcio A",
          nomeOperadora: "Operadora A",
          operadoraCpfCnpj: "12345678901",
          idConsorcio: "C1",
          dataCaptura: new Date(),
          bqUpdatedAt: new Date(),
        }),
        new OrdemPagamento({
          userId: 2,
          valor: 200,
          idOperadora: "2",
          dataOrdem: new Date(),
          nomeConsorcio: "Consorcio B",
          nomeOperadora: "Operadora B",
          operadoraCpfCnpj: "98765432109",
          idConsorcio: "C2",
          dataCaptura: new Date(),
          bqUpdatedAt: new Date(),
        }),
      ];

      const user = new User({
        id: 1,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        cpfCnpj: '12345678901',
        bankCode: 1,
        bankAgency: '1234',
        bankAccount: '123456',
        bankAccountDigit: '7',
        phone: '1234567890',
        permitCode: 'ABC123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);

      const result = await service.buildHistoricoFromOrdemPagamentoAgrupado(ordemPagamentoAgrupado);

      expect(result).toBeInstanceOf(OrdemPagamentoAgrupadoHistorico);
      expect(result.ordemPagamentoAgrupado).toBe(ordemPagamentoAgrupado);
      expect(result.userBankCode).toBe(user.bankCode?.toString());
      expect(result.userBankAgency).toBe(user.bankAgency?.toString());
      expect(result.userBankAccount).toBe(user.bankAccount?.toString());
      expect(result.userBankAccountDigit).toBe(user.bankAccountDigit?.toString());
      expect(result.statusRemessa).toBe(StatusRemessaEnum.Criado);
    });

    it('should throw an error if no user is found', async () => {
      const ordemPagamentoAgrupado = new OrdemPagamentoAgrupado();

      ordemPagamentoAgrupado.ordensPagamento = [
        new OrdemPagamento({
          userId: undefined,
          valor: 100,
          idOperadora: "1",
          dataOrdem: new Date(),
          nomeConsorcio: "Consorcio A",
          nomeOperadora: "Operadora A",
          operadoraCpfCnpj: "12345678901",
          idConsorcio: "C1",
          dataCaptura: new Date(),
          bqUpdatedAt: new Date(),
        })
      ];

      await expect(service.buildHistoricoFromOrdemPagamentoAgrupado(ordemPagamentoAgrupado)).rejects.toThrow('Nenhum usuário encontrado para a ordem de pagamento');
    });

    it('should throw an error if user bank details are not found', async () => {
      const ordemPagamentoAgrupado = new OrdemPagamentoAgrupado();

      ordemPagamentoAgrupado.ordensPagamento = [
        new OrdemPagamento({
          userId: 1,
          valor: 100,
          idOperadora: "1",
          dataOrdem: new Date(),
          nomeConsorcio: "Consorcio A",
          nomeOperadora: "Operadora A",
          operadoraCpfCnpj: "12345678901",
          idConsorcio: "C1",
          dataCaptura: new Date(),
          bqUpdatedAt: new Date(),
        }),
      ];

      const user = new User({
        id: 1,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        cpfCnpj: '12345678901',
        bankCode: 1,
        phone: '1234567890',
        permitCode: 'ABC123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);

      await expect(service.buildHistoricoFromOrdemPagamentoAgrupado(ordemPagamentoAgrupado)).rejects.toThrow('Dados bancários do usuário não encontrados');
    });
  });

  describe('saveAll', () => {
    it('should call the repository methods correctly', async () => {
      const dataInicial = new Date();
      const dataFinal = new Date();
      const dataPgto = new Date();
      const pagador = new Pagador();
      pagador.id = 1;
      pagador.agencia = '1234';
      pagador.conta = '123456';
      pagador.dvConta = '7';
      pagador.dvAgencia = '1';
      const ordensAgrupadas: OrdensPagamentoAgrupadasDto[] = [
        {
          userId: 1,
          dataOrdem: new Date(),
          idOperadora: 'op1',
          valorTotal: 100,
          ordensPagamento: [
            new OrdemPagamento({
              id: 1,
              userId: 1,
              dataOrdem: new Date(),
              valor: 100,
              idOperadora: 'op1',
              nomeConsorcio: 'Consorcio A',
              nomeOperadora: 'Operadora A',
              operadoraCpfCnpj: '12345678901',
              idConsorcio: 'C1',
              dataCaptura: new Date(),
              bqUpdatedAt: new Date(),
            }),
          ],
        },
      ];

      jest.spyOn(ordemPagamentoRepository, 'findOrdensPagamentoAgrupadas').mockResolvedValue(ordensAgrupadas);
      jest.spyOn(ordemPagamentoAgrupadoRepository, 'save').mockResolvedValue(new OrdemPagamentoAgrupado());
      jest.spyOn(service, 'buildHistoricoFromOrdemPagamentoAgrupado').mockResolvedValue(new OrdemPagamentoAgrupadoHistorico());
      jest.spyOn(ordemPagamentoAgrupadoHistoricoRepository, 'save').mockResolvedValue(new OrdemPagamentoAgrupadoHistorico());

      await service.saveAll(dataInicial, dataFinal, pagador, dataPgto);

      expect(ordemPagamentoRepository.findOrdensPagamentoAgrupadas).toHaveBeenCalledWith({ dataOrdem: expect.any(Object) });
      expect(ordemPagamentoAgrupadoRepository.save).toHaveBeenCalled();
      expect(ordemPagamentoAgrupadoHistoricoRepository.save).toHaveBeenCalled();
    });
  });
});