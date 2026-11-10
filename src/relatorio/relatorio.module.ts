import { Module } from '@nestjs/common';
import { CnabModule } from 'src/cnab/cnab.module';

import { RelatorioNovoRemessaController } from './novo-remessa/relatorio-novo-remessa.controller';
import { RelatorioNovoRemessaConsolidadoRepository } from './novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';
import { RelatorioAnaliticoRepository } from './analitico/relatorio-analitico.repository';
import { RelatorioSinteticoRepository } from './sintetico/relatorio-sintetico.repository';
import { RelatorioExtratoBancarioRepository } from './extrato-bancario/relatorio-extrato-bancario.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioNovoRemessaMovimentacaoRepository } from './novo-remessa/relatorio-novo-remessa-movimentacao.repository';
import { RelatorioGuardadorConsolidadoRepository } from './consolidado/relatorio-guardador-consolidado.repository';
import { RelatorioGuardadorFinancialMovementRepository } from './movimentacao-financeira/relatorio-guardador-financial-movement.repository';
import { RelatorioController } from './relatorio.controller';
import { ConsolidadoV2Controller } from './consolidado-v2/consolidado-v2.controller';
import { ConsorcioAggregatorService } from './consolidado-v2/consorcio-aggregator.service';
import { EleicaoAggregatorService } from './consolidado-v2/eleicao-aggregator.service';
import { VanzeiroAggregatorService } from './consolidado-v2/vanzeiro-aggregator.service';
import { BasePagamentoRepository } from './movimentacao-financeira-v2/base/base-pagamento.repository';
import { StucGratuidadeRepository } from './movimentacao-financeira-v2/stuc-gratuidade/stuc-gratuidade.repository';
import { FinancialMovementV2ExportService } from './movimentacao-financeira-v2/export/financial-movement-v2-export.service';
import { FinancialMovementV2SummaryService } from './movimentacao-financeira-v2/summary/financial-movement-v2-summary.service';
import { RelatorioNovoRemessaV2Controller } from './novo-remessa-v2/relatorio-novo-remessa-v2.controller';

@Module({
  imports: [CnabModule],
  controllers: [RelatorioNovoRemessaController, RelatorioController, ConsolidadoV2Controller, RelatorioNovoRemessaV2Controller],
  providers: [
    RelatorioNovoRemessaService,
    RelatorioSinteticoRepository,
    RelatorioAnaliticoRepository,
    RelatorioNovoRemessaConsolidadoRepository,
    RelatorioNovoRemessaMovimentacaoRepository,
    RelatorioExtratoBancarioRepository,
    RelatorioNovoRemessaFinancialMovementService,
    RelatorioGuardadorConsolidadoRepository,
    RelatorioGuardadorFinancialMovementRepository,
    // ADR 0022 (Consolidado-v2, fatia 1) - rota paralela v2, nao usada pelo app-cct ainda.
    BasePagamentoRepository,
    // ADR 0021 (Movimentacao Financeira v2, T8/T9) - repositorio e export dedicados, ainda
    // sem controller proprio (T10).
    StucGratuidadeRepository,
    FinancialMovementV2ExportService,
    // T10: servico de summary/page novo (combina as 3 fontes de Permissionario por filtro) +
    // controller v2 paralelo, consumindo tudo acima.
    FinancialMovementV2SummaryService,
    VanzeiroAggregatorService,
    ConsorcioAggregatorService,
    EleicaoAggregatorService,
  ],
  exports: [
    RelatorioNovoRemessaFinancialMovementService,
    RelatorioGuardadorConsolidadoRepository,
    RelatorioGuardadorFinancialMovementRepository,
  ],
})
export class RelatorioModule { }
