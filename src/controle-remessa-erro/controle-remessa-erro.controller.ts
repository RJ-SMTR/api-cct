import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ControleRemessaErroService, LancamentoManualInput, OrigemControle } from './controle-remessa-erro.service';

/** Controle Remessa Erros (Administração do Sistema): só a role Admin Master TI. */
@ApiTags('ControleRemessaErro')
@ApiBearerAuth()
@Controller({ path: 'controle-remessa-erros', version: '1' })
@Roles(RoleEnum.master_ti)
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ControleRemessaErroController {
  constructor(private readonly service: ControleRemessaErroService) {}

  /** Remessas com erro (automático, a partir dos pagamentos não efetivados) e lançamentos manuais, juntos. */
  @Get()
  listar(@Query() q: Record<string, string>) {
    return this.service.listar({
      dataInicio: q.dataInicio,
      dataFim: q.dataFim,
      busca: q.busca?.slice(0, 100),
      origem: (['automatico', 'manual'].includes(q.origem) ? q.origem : undefined) as OrigemControle | undefined,
      status: q.status?.slice(0, 40) || undefined,
      page: Number(q.page),
      pageSize: Number(q.pageSize),
    });
  }

  @Post()
  criar(@Body() body: LancamentoManualInput, @Req() req: any) {
    return this.service.criar(body ?? {}, Number(req.user.id));
  }

  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() body: LancamentoManualInput, @Req() req: any) {
    return this.service.atualizar(id, body ?? {}, Number(req.user.id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(@Param('id', ParseIntPipe) id: number) {
    return this.service.excluir(id);
  }
}
