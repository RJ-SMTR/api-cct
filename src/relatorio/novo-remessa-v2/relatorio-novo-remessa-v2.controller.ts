import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Query, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Response } from 'express';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { FinancialMovementQueryDto } from '../dtos/pay-and-pending-query.dto';
import { FinancialMovementExportRequestDto } from '../dtos/financial-movement-export-request.dto';
import { FinancialMovementV2SummaryService } from '../movimentacao-financeira-v2/summary/financial-movement-v2-summary.service';
import { FinancialMovementV2ExportService } from '../movimentacao-financeira-v2/export/financial-movement-v2-export.service';
import { mapQueryToFinancialMovementV2Filter } from '../movimentacao-financeira-v2/summary/financial-movement-v2-query.mapper';
import { RelatorioNovoRemessaFinancialMovementService } from '../movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { MODAIS } from '../movimentacao-financeira-v2/status/consorcio-resolver';

// Perfil nao e' importado do repository (ESLint bloqueia controller -> repository direto,
// "Controllers must go through a service") - mesmo literal usado por BasePagamentoRepository.
type Perfil = 'permissionario' | 'guardador';

// STUC-Gratuidade e Eleicao: mesmo resultado da rota v1 (decisao de Rayanne, 2026-11-10), pela
// propria implementacao do legado. Guardador nao tem essas categorias.
function usaLegado(perfil: Perfil, query: Pick<FinancialMovementQueryDto, 'eleicao' | 'stucGratuidade'>): boolean {
  return perfil === 'permissionario' && Boolean(query.eleicao || query.stucGratuidade);
}

type Selecao = Pick<FinancialMovementQueryDto, 'userIds' | 'todosVanzeiros' | 'consorcioNome' | 'todosConsorcios'>;

// Mesma selecao de favorecido/consorcio do Consolidado (consolidado-v2.controller.ts e
// ConsolidadoCombinadoService), para os dois relatorios darem o mesmo total (regra de Rayanne,
// 2026-11-11). Vale para resumo, pagina e exportacao, no caminho v2 e no legado.
export function normalizarSelecao<T extends Selecao>(perfil: Perfil, query: T): T {
  if (perfil !== 'permissionario') return query;
  // "Todos os favorecidos" tem prioridade sobre um favorecido escolhido, como no Consolidado.
  const userIds = query.todosVanzeiros ? undefined : query.userIds;
  const consorcioNome = query.consorcioNome?.length ? query.consorcioNome : undefined;
  const nadaSelecionado = !userIds?.length && !query.todosVanzeiros && !consorcioNome && !query.todosConsorcios;
  if (nadaSelecionado) {
    // Sem favorecido nem consorcio, o Consolidado une as duas visoes, e o total e' o de todos os consorcios.
    return { ...query, userIds: undefined, todosConsorcios: true };
  }
  if (query.todosVanzeiros && consorcioNome && !consorcioNome.some((nome) => MODAIS.includes(nome.trim().toUpperCase()))) {
    // Todos os favorecidos + consorcio que nao cobre os modais: o Consolidado soma o consorcio e os
    // individuais de modal (STPC/STPL/TEC).
    return { ...query, userIds, consorcioNome: [...consorcioNome, ...MODAIS] };
  }
  return { ...query, userIds };
}

// Rotas v2 paralelas (T10, ADR 0021 item 7, decisao 2026-11-09): mesmo base path e mesmos DTOs
// de request do controller legado (RelatorioNovoRemessaController, NUNCA tocado por esta task -
// ver cabecalho do arquivo dele), servidas pela implementacao nova (T1-T9). Acessivel em
// producao (mesmo guard do controller legado) so para comparacao lado a lado antes do cutover
// (T12) - sem trafego do app-cct ainda.
@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio-novo-remessa',
  version: '1',
})
export class RelatorioNovoRemessaV2Controller {
  constructor(
    private readonly financialMovementV2SummaryService: FinancialMovementV2SummaryService,
    private readonly financialMovementV2ExportService: FinancialMovementV2ExportService,
    private readonly relatorioNovoRemessaFinancialMovementService: RelatorioNovoRemessaFinancialMovementService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('report/v2/summary')
  async getFinancialMovementSummaryV2(
    @Query(new ValidationPipe({ transform: true })) queryParams: FinancialMovementQueryDto,
  ) {
    return this.handleSummary('permissionario', queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('report/v2/page')
  async getFinancialMovementPageV2(
    @Query(new ValidationPipe({ transform: true })) queryParams: FinancialMovementQueryDto,
  ) {
    return this.handlePage('permissionario', queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('report/v2/export/download')
  async downloadFinancialMovementReportV2(
    @Body(new ValidationPipe({ transform: true })) body: FinancialMovementExportRequestDto,
    @Res() response: Response,
  ) {
    await this.handleDownload('permissionario', body, response);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('guardador/report/v2/summary')
  async getGuardadorFinancialMovementSummaryV2(
    @Query(new ValidationPipe({ transform: true })) queryParams: FinancialMovementQueryDto,
  ) {
    return this.handleSummary('guardador', queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('guardador/report/v2/page')
  async getGuardadorFinancialMovementPageV2(
    @Query(new ValidationPipe({ transform: true })) queryParams: FinancialMovementQueryDto,
  ) {
    return this.handlePage('guardador', queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('guardador/report/v2/export/download')
  async downloadGuardadorFinancialMovementReportV2(
    @Body(new ValidationPipe({ transform: true })) body: FinancialMovementExportRequestDto,
    @Res() response: Response,
  ) {
    await this.handleDownload('guardador', body, response);
  }

  private async handleSummary(perfil: Perfil, query: FinancialMovementQueryDto) {
    const queryParams = normalizarSelecao(perfil, query);
    try {
      if (usaLegado(perfil, queryParams)) {
        return await this.relatorioNovoRemessaFinancialMovementService.findFinancialMovementSummary(queryParams);
      }
      return await this.financialMovementV2SummaryService.findSummary(perfil, mapQueryToFinancialMovementV2Filter(queryParams));
    } catch (e) {
      throw new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  private async handlePage(perfil: Perfil, query: FinancialMovementQueryDto) {
    const queryParams = normalizarSelecao(perfil, query);
    try {
      if (usaLegado(perfil, queryParams)) {
        return await this.relatorioNovoRemessaFinancialMovementService.findFinancialMovementPage(queryParams);
      }
      return await this.financialMovementV2SummaryService.findPage(perfil, mapQueryToFinancialMovementV2Filter(queryParams));
    } catch (e) {
      throw new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  private async handleDownload(perfil: Perfil, request: FinancialMovementExportRequestDto, response: Response) {
    const body = normalizarSelecao(perfil, request);
    let generatedFile: Awaited<ReturnType<FinancialMovementV2ExportService['downloadFinancialMovementExport']>> | undefined;
    try {
      generatedFile = usaLegado(perfil, body)
        ? await this.relatorioNovoRemessaFinancialMovementService.downloadFinancialMovementExport(body)
        : await this.financialMovementV2ExportService.downloadFinancialMovementExport(perfil, {
            ...mapQueryToFinancialMovementV2Filter(body),
            format: body.format,
          });
      const file = generatedFile;

      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', file.contentType);
      response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

      await pipeline(createReadStream(file.filePath), response);
    } catch (e) {
      if (!response.headersSent) {
        response.status(HttpStatus.BAD_REQUEST).json({ error: e.message });
      }
    } finally {
      if (generatedFile) {
        await this.financialMovementV2ExportService.removeGeneratedExportFile(generatedFile.filePath);
      }
    }
  }
}
