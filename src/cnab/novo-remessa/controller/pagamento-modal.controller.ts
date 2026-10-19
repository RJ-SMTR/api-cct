import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { parseFimDoDia, parseInicioDoDia } from 'src/utils/date-utils';
import { PagamentoModalService } from '../service/pagamento-modal.service';
import { PagamentoConsorcioPrepararDto } from '../dto/pagamento-consorcio-preparar.dto';
import { PagamentoConsorcioEnviarBancoDto } from '../dto/pagamento-consorcio-enviar-banco.dto';

@ApiTags('PagamentoModal')
@Controller({
  path: 'pagamentos/modais',
  version: '1',
})
export class PagamentoModalController {
  constructor(private readonly pagamentoModalService: PagamentoModalService) {}

  @Post('preparar')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async preparar(@Body() dto: PagamentoConsorcioPrepararDto) {
    this.pagamentoModalService.iniciarPreparacaoAssincrona(
      parseInicioDoDia(dto.dataInicio),
      parseFimDoDia(dto.dataFim),
      dto.gratuidade,
    );
    return { iniciado: true };
  }

  @Get('preparar/status')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async statusPreparacao() {
    return this.pagamentoModalService.getStatusPreparacao();
  }

  @Get('preparados')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'busca', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async listarPreparados(
    @Query('page', new ParseNumberPipe({ min: 1, optional: true })) page?: number,
    @Query('pageSize', new ParseNumberPipe({ min: 1, optional: true })) pageSize?: number,
    @Query('busca') busca?: string,
  ) {
    return this.pagamentoModalService.listarPreparadosAtual(page, pageSize, busca);
  }

  @Get('valor-bi/:detalheAId/detalhamento')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async detalhamento(@Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    return this.pagamentoModalService.detalharPorDia(detalheAId);
  }

  @Delete('preparo')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async limparPreparo() {
    return this.pagamentoModalService.limparPreparoAtual();
  }

  @Post('gerar-remessa')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async gerarRemessa() {
    return this.pagamentoModalService.gerarRemessa();
  }

  @Post('enviar-banco')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async enviarBanco(@Request() request: IRequest, @Body() dto: PagamentoConsorcioEnviarBancoDto) {
    return this.pagamentoModalService.enviarParaBanco(dto.senha, request.user.id);
  }
}
