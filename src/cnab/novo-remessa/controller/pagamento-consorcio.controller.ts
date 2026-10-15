import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { parseFimDoDia, parseInicioDoDia } from 'src/utils/date-utils';
import { PagamentoConsorcioService } from '../service/pagamento-consorcio.service';
import { PagamentoConsorcioPrepararDto } from '../dto/pagamento-consorcio-preparar.dto';
import { PagamentoConsorcioValorBiDto } from '../dto/pagamento-consorcio-valor-bi.dto';
import { PagamentoConsorcioEnviarBancoDto } from '../dto/pagamento-consorcio-enviar-banco.dto';

@ApiTags('PagamentoConsorcio')
@Controller({
  path: 'pagamentos/consorcios',
  version: '1',
})
export class PagamentoConsorcioController {
  constructor(private readonly pagamentoConsorcioService: PagamentoConsorcioService) {}

  @Post('preparar')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async preparar(@Body() dto: PagamentoConsorcioPrepararDto) {
    return this.pagamentoConsorcioService.prepararPagamentos(parseInicioDoDia(dto.dataInicio), parseFimDoDia(dto.dataFim));
  }

  @Patch('valor-bi/:detalheAId')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async atualizarValorBi(
    @Request() request: IRequest,
    @Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number,
    @Body() dto: PagamentoConsorcioValorBiDto,
  ) {
    return this.pagamentoConsorcioService.atualizarValorBi(detalheAId, dto.novoValor, dto.senha, request.user.id);
  }

  @Get('valor-bi/:detalheAId/auditoria')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async auditoria(@Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    return this.pagamentoConsorcioService.listarAuditoria(detalheAId);
  }

  @Get('valor-bi/:detalheAId/detalhamento')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async detalhamento(@Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    return this.pagamentoConsorcioService.detalharPorDia(detalheAId);
  }

  @Delete('preparo')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async limparPreparo() {
    return this.pagamentoConsorcioService.limparPreparoAtual();
  }

  @Post('gerar-remessa')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async gerarRemessa() {
    return this.pagamentoConsorcioService.gerarRemessa();
  }

  @Post('enviar-banco')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async enviarBanco(@Request() request: IRequest, @Body() dto: PagamentoConsorcioEnviarBancoDto) {
    return this.pagamentoConsorcioService.enviarParaBanco(dto.senha, request.user.id);
  }
}
