import { Module } from '@nestjs/common';
import { CnabModule } from 'src/cnab/cnab.module';

import { RelatorioNovoRemessaController } from './novo-remessa/relatorio-novo-remessa.controller';
import { RelatorioNovoRemessaConsolidadoRepository } from './novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';
import { RelatorioAnaliticoRepository } from './analitico/relatorio-analitico.repository';
import { RelatorioSinteticoRepository } from './sintetico/relatorio-sintetico.repository';
import { RelatorioExtratoBancarioRepository } from './extrato-bancario/relatorio-extrato-bancario.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioNovoRemessaFinancialMovementRepository } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.repository';
import { RelatorioNovoRemessaMovimentacaoRepository } from './novo-remessa/relatorio-novo-remessa-movimentacao.repository';

@Module({
  imports: [CnabModule],
  controllers: [RelatorioNovoRemessaController],
  providers: [RelatorioNovoRemessaService,
    RelatorioSinteticoRepository, RelatorioAnaliticoRepository,
    RelatorioNovoRemessaConsolidadoRepository,
    RelatorioNovoRemessaMovimentacaoRepository,
    RelatorioExtratoBancarioRepository,
    RelatorioNovoRemessaFinancialMovementRepository, RelatorioNovoRemessaFinancialMovementService],
  exports: [
    RelatorioNovoRemessaFinancialMovementService,
    RelatorioNovoRemessaFinancialMovementRepository,
  ],
})
export class RelatorioModule { }
