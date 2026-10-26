import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { parseFimDoDia, parseInicioDoDia } from 'src/utils/date-utils';
import { PagamentoGuardadorService } from '../service/pagamento-guardador.service';
import { PagamentoGuardadorPrepararDto } from '../dto/pagamento-guardador-preparar.dto';
import { PagamentoConsorcioValorBiDto } from '../dto/pagamento-consorcio-valor-bi.dto';
import { PagamentoRenovarNsaDto } from '../dto/pagamento-renovar-nsa.dto';
import { PagamentoConsorcioEnviarBancoDto } from '../dto/pagamento-consorcio-enviar-banco.dto';

@ApiTags('PagamentoGuardador')
@Controller({
  path: 'pagamentos/guardador',
  version: '1',
})
export class PagamentoGuardadorController {
  constructor(private readonly pagamentoGuardadorService: PagamentoGuardadorService) {}

  @Post('preparar')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async preparar(@Body() dto: PagamentoGuardadorPrepararDto) {
    const opcoesIndevido =
      dto.descontarIndevido === undefined ? undefined : { descontar: dto.descontarIndevido, percentual: dto.percentualDescontoIndevido ?? 100 };
    return this.pagamentoGuardadorService.prepararPagamentos(parseInicioDoDia(dto.dataInicio), parseFimDoDia(dto.dataFim), opcoesIndevido);
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
    return this.pagamentoGuardadorService.atualizarValorBi(detalheAId, dto.novoValor, dto.senha, request.user.id);
  }

  @Get('valor-bi/:detalheAId/auditoria')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async auditoria(@Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    return this.pagamentoGuardadorService.listarAuditoria(detalheAId);
  }

  @Get('valor-bi/:detalheAId/detalhamento')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async detalhamento(@Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    return this.pagamentoGuardadorService.detalharPorDia(detalheAId);
  }

  @Delete('preparo')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async limparPreparo() {
    return this.pagamentoGuardadorService.limparPreparoAtual();
  }

  @Post('renovar-nsa')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async renovarNsa(@Body() dto: PagamentoRenovarNsaDto) {
    return this.pagamentoGuardadorService.renovarNsa(dto.nsa);
  }

  @Post('gerar-remessa')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async gerarRemessa() {
    return this.pagamentoGuardadorService.gerarRemessa();
  }

  @Post('enviar-banco')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async enviarBanco(@Request() request: IRequest, @Body() dto: PagamentoConsorcioEnviarBancoDto) {
    return this.pagamentoGuardadorService.enviarParaBanco(dto.senha, request.user.id);
  }
}
