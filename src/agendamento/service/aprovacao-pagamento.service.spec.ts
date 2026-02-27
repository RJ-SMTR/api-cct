import { Test, TestingModule } from '@nestjs/testing';
import { AprovacaoPagamentoService } from './aprovacao-pagamento.service';
import { AprovacaoPagamentoRepository } from '../repository/aprovacao-pagamento.repository';
import { AprovacaoPagamentoConvert } from '../convert/aprovacao-pagamento.convert';
import { UsersService } from 'src/users/users.service';

describe('AprovacaoPagamentoService', () => {
  let service: AprovacaoPagamentoService;
  let repository: AprovacaoPagamentoRepository;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AprovacaoPagamentoService,
        {
          provide: AprovacaoPagamentoRepository,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            approvePayment: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: AprovacaoPagamentoConvert,
          useValue: {
            convertEntityToDTO: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AprovacaoPagamentoService>(AprovacaoPagamentoService);
    repository = module.get<AprovacaoPagamentoRepository>(AprovacaoPagamentoRepository);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('approvePayment should load approver user and forward approval to repository', async () => {
    const user = { id: 7, fullName: 'Approver' };
    const approved = { id: 99, status: 1, valorAprovado: 123.45 };

    (usersService.findOne as jest.Mock).mockResolvedValue(user);
    (repository.approvePayment as jest.Mock).mockResolvedValue(approved);

    const result = await service.approvePayment(99, 7, 'secret', 123.45);

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 7 });
    expect(repository.approvePayment).toHaveBeenCalledWith(99, user, 'secret', 123.45);
    expect(result).toEqual(approved);
  });
});
