import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from 'src/users/users.service';
import { AgendamentoPagamentoConvert } from '../convert/agendamento-pagamento.convert';
import { AprovacaoEnum } from '../enums/aprovacao.enum';
import { AprovacaoPagamentoRepository } from '../repository/aprovacao-pagamento.repository';
import { AgendamentoPagamentoRepository } from '../repository/agendamento-pagamento.repository';
import { AgendamentoPagamentoService } from './agendamento-pagamento.service';

describe('AgendamentoPagamentoService', () => {
  let service: AgendamentoPagamentoService;
  let repository: AgendamentoPagamentoRepository;
  let aprovacaoRepository: AprovacaoPagamentoRepository;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendamentoPagamentoService,
        {
          provide: AgendamentoPagamentoRepository,
          useValue: {
            findAllBooking: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: AgendamentoPagamentoConvert,
          useValue: {
            convertEntityToDTO: jest.fn(),
          },
        },
        {
          provide: AprovacaoPagamentoRepository,
          useValue: {
            save: jest.fn(),
            delete: jest.fn(),
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

    service = module.get<AgendamentoPagamentoService>(AgendamentoPagamentoService);
    repository = module.get<AgendamentoPagamentoRepository>(AgendamentoPagamentoRepository);
    aprovacaoRepository = module.get<AprovacaoPagamentoRepository>(AprovacaoPagamentoRepository);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delete should allow approver to delete approved schedule with approval', async () => {
    const approver = { id: 5, password: 'hashed' };
    const deleted = { affected: 1 };
    const aprovacaoId = 99;

    (repository.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      aprovacaoPagamento: { id: aprovacaoId, status: AprovacaoEnum.Aprovado, aprovador: approver },
    });
    (usersService.findOne as jest.Mock).mockResolvedValue(approver);
    (repository.delete as jest.Mock).mockResolvedValue(deleted);
    (aprovacaoRepository.delete as jest.Mock).mockResolvedValue(undefined);

    const result = await service.delete(10, 'secret', 5);

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 5 });
    expect(repository.delete).toHaveBeenCalledWith(10, 'secret', approver);
    expect(aprovacaoRepository.delete).toHaveBeenCalledWith(aprovacaoId);
    expect(result).toEqual(deleted);
  });

  it('delete should block non-approver from deleting approved schedule', async () => {
    const approver = { id: 5 };
    const otherUser = { id: 3, password: 'hashed' };

    (repository.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      aprovacaoPagamento: { status: AprovacaoEnum.Aprovado, aprovador: approver },
    });
    (usersService.findOne as jest.Mock).mockResolvedValue(otherUser);

    await expect(service.delete(10, 'secret', 3)).rejects.toThrow(ConflictException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('delete should allow any user to delete schedule without approved payment', async () => {
    const user = { id: 3, password: 'hashed' };
    const deleted = { affected: 1 };

    (repository.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      aprovacaoPagamento: { status: AprovacaoEnum.Rejeitado },
    });
    (usersService.findOne as jest.Mock).mockResolvedValue(user);
    (repository.delete as jest.Mock).mockResolvedValue(deleted);

    const result = await service.delete(10, 'secret', 3);

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 3 });
    expect(repository.delete).toHaveBeenCalledWith(10, 'secret', user);
    expect(result).toEqual(deleted);
  });

  it('delete should allow any user to delete schedule without approval', async () => {
    const user = { id: 3, password: 'hashed' };
    const deleted = { affected: 1 };

    (repository.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      aprovacaoPagamento: null,
    });
    (usersService.findOne as jest.Mock).mockResolvedValue(user);
    (repository.delete as jest.Mock).mockResolvedValue(deleted);

    const result = await service.delete(10, 'secret', 3);

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 3 });
    expect(repository.delete).toHaveBeenCalledWith(10, 'secret', user);
    expect(result).toEqual(deleted);
  });
});