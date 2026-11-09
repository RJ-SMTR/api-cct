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
import { VanzeiroAggregatorService } from './consolidado-v2/vanzeiro-aggregator.service';
import { BasePagamentoRepository } from './movimentacao-financeira-v2/base/base-pagamento.repository';

@Module({
  imports: [CnabModule],
  controllers: [RelatorioNovoRemessaController, RelatorioController, ConsolidadoV2Controller],
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
    VanzeiroAggregatorService,
    ConsorcioAggregatorService,
  ],
  exports: [
    RelatorioNovoRemessaFinancialMovementService,
    RelatorioGuardadorConsolidadoRepository,
    RelatorioGuardadorFinancialMovementRepository,
  ],
})
export class RelatorioModule { }
