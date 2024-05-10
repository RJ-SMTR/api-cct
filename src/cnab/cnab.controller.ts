import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ExtratoDto } from './service/dto/extrato.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';

@ApiTags('Cnab')
@Controller({
  path: 'cnab',
  version: '1',
})
export class CnabController {
  constructor(
    private readonly clienteFavorecidoService: ClienteFavorecidoService,
    private readonly extratoHeaderArquivoService: ExtratoHeaderArquivoService,
  ) {}

  @Get('clientes-favorecidos')
  getClienteFavorecido(): Promise<ClienteFavorecido[]> {
    return this.clienteFavorecidoService.getAll();
  }

  @ApiQuery({
    name: 'conta',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'dt_inicio',
    required: true,
    type: String,
    example: '2024-01-01'
  })
  @ApiQuery({
    name: 'dt_fim',
    required: true,
    type: String,
    example: '2024-12-25'
  })
  @ApiQuery({
    name: 'tipo',
    required: false,
    type: String,
    example: 'cett'
  })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('extratoLancamento')
  async getLancamentoExtrato(
    @Query('conta') conta: string,
    @Query('dt_inicio', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/))
    dt_inicio: string,
    @Query('dt_fim', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/)) dt_fim: string,
    @Query('tipo') tipoLancamento?: string,
  ): Promise<ExtratoDto[]> {
    return await this.extratoHeaderArquivoService.getExtrato(
      conta,
      dt_inicio,
      dt_fim,
      tipoLancamento,
    );
  }
}
