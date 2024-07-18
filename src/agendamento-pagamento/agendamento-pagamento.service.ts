import { Injectable } from '@nestjs/common';
import { CreateAgendamentoPagamentoDTO } from './dtos/create-agendamento-pagamento.dto';
import { Repository } from 'typeorm';
import { AgendamentoPagamento } from './agendamento-pagamento.entity';
import { validateDTO } from 'src/utils/validation-utils';
import { UsersService } from 'src/users/users.service';
import { IRequest } from 'src/utils/interfaces/request.interface';

@Injectable()
export class AgendamentoPagamentoService {
  constructor(
    private agendamentoPagamentoRepository: Repository<AgendamentoPagamento>,
    private usersService: UsersService,
  ) {}
  async saveFromController(
    dto: CreateAgendamentoPagamentoDTO,
    request: IRequest,
  ) {
    // Validar se usuário da request existe
    this.usersService.getOneFromRequest(request);
    const saved: AgendamentoPagamento[] =
      await this.agendamentoPagamentoRepository.save([dto]);
    return saved[0];
  }
}
