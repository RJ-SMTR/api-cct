import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { AgendamentoPagamentoService } from './agendamento-pagamento.service';
import { CreateAgendamentoPagamentoDTO } from './dtos/create-agendamento-pagamento.dto';

@ApiTags('Cnab')
@Controller({
  path: 'cnab/agendamento',
  version: '1',
})
export class AgendamentoPagamentoController {
  constructor(
    private readonly agendamentoPagamentoService: AgendamentoPagamentoService,
  ) {}

  /**
   * Agendar remessa
   *
   * Requisitos:
   * - Criar remessa com os parâmetros abaixo
   */
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async post(
    @Request() request: IRequest,
    @Body() agendamentoPagamentoDTO: CreateAgendamentoPagamentoDTO,
  ) {
    return await this.agendamentoPagamentoService.saveFromController(
      agendamentoPagamentoDTO,
      request,
    );
  }
}
