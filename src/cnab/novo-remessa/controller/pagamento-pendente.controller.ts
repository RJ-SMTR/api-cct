import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { parseFimDoDia, parseInicioDoDia } from 'src/utils/date-utils';
import { PagamentoPendenteService, TIPOS_PENDENTE, TipoPendente } from '../service/pagamento-pendente.service';
import { PagamentoConsorcioPrepararDto } from '../dto/pagamento-consorcio-preparar.dto';
import { PagamentoConsorcioValorBiDto } from '../dto/pagamento-consorcio-valor-bi.dto';
import { PagamentoConsorcioEnviarBancoDto } from '../dto/pagamento-consorcio-enviar-banco.dto';

const tipoValido = (tipo: string): TipoPendente => {
  if (!TIPOS_PENDENTE.includes(tipo as TipoPendente)) {
    throw new HttpException({ error: 'Tipo de pendente inválido (permissionarios ou guardadores).' }, HttpStatus.NOT_FOUND);
  }
  return tipo as TipoPendente;
};

/** Mesmos passos dos pagamentos normais, para os pendentes de permissionários e de guardadores. */
@ApiTags('PagamentoPendente')
@Controller({ path: 'pagamentos/pendentes/:tipo', version: '1' })
@Roles(RoleEnum.master, RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class PagamentoPendenteController {
  constructor(private readonly service: PagamentoPendenteService) {}

  @Post('preparar')
  @HttpCode(HttpStatus.OK)
  async preparar(@Param('tipo') tipo: string, @Body() dto: PagamentoConsorcioPrepararDto) {
    return this.service.prepararPagamentos(tipoValido(tipo), parseInicioDoDia(dto.dataInicio), parseFimDoDia(dto.dataFim));
  }

  @Get('preparados')
  @HttpCode(HttpStatus.OK)
  async preparados(@Param('tipo') tipo: string) {
    return this.service.listarPreparados(tipoValido(tipo));
  }

  @Patch('valor-bi/:detalheAId')
  @HttpCode(HttpStatus.OK)
  async atualizarValorBi(
    @Request() request: IRequest,
    @Param('tipo') tipo: string,
    @Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number,
    @Body() dto: PagamentoConsorcioValorBiDto,
  ) {
    tipoValido(tipo);
    return this.service.atualizarValorBi(detalheAId, dto.novoValor, dto.senha, request.user.id);
  }

  @Get('valor-bi/:detalheAId/auditoria')
  @HttpCode(HttpStatus.OK)
  async auditoria(@Param('tipo') tipo: string, @Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    tipoValido(tipo);
    return this.service.listarAuditoria(detalheAId);
  }

  @Get('valor-bi/:detalheAId/detalhamento')
  @HttpCode(HttpStatus.OK)
  async detalhamento(@Param('tipo') tipo: string, @Param('detalheAId', new ParseNumberPipe({ min: 1 })) detalheAId: number) {
    return this.service.detalharPorDia(tipoValido(tipo), detalheAId);
  }

  @Delete('preparo')
  @HttpCode(HttpStatus.OK)
  async limparPreparo(@Param('tipo') tipo: string) {
    return this.service.limparPreparoAtual(tipoValido(tipo));
  }

  @Post('gerar-remessa')
  @HttpCode(HttpStatus.OK)
  async gerarRemessa(@Param('tipo') tipo: string) {
    return this.service.gerarRemessa(tipoValido(tipo));
  }

  @Post('enviar-banco')
  @HttpCode(HttpStatus.OK)
  async enviarBanco(@Request() request: IRequest, @Param('tipo') tipo: string, @Body() dto: PagamentoConsorcioEnviarBancoDto) {
    return this.service.enviarParaBanco(tipoValido(tipo), dto.senha, request.user.id);
  }
}
