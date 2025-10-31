import { Module } from '@nestjs/common';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { CnabModule } from 'src/configuration/cnab/cnab.module';

import { RelatorioNovoRemessaController } from './novo-remessa/relatorio-novo-remessa.controller';
import { RelatorioNovoRemessaRepository } from './novo-remessa/relatorio-novo-remessa.repository';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';
import { RelatorioAnaliticoRepository } from './analitico/relatorio-analitico.repository';
import { RelatorioConsolidadoRepository } from './consolidado/relatorio-consolidado.repository';
import { RelatorioNovoRemessaFinancialMovementRepository } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioSinteticoRepository } from './sintetico/relatorio-sintetico.repository';
import { RelatorioExtratoBancarioRepository } from './extrato-bancario/relatorio-extrato-bancario.repository';


@Module({
  imports: [CnabModule],
  controllers: [RelatorioController, RelatorioNovoRemessaController],
  providers: [RelatorioService, RelatorioNovoRemessaService, RelatorioConsolidadoRepository,
    RelatorioSinteticoRepository, RelatorioAnaliticoRepository, RelatorioNovoRemessaRepository,
    RelatorioExtratoBancarioRepository,
    RelatorioNovoRemessaFinancialMovementRepository, RelatorioNovoRemessaFinancialMovementService]
})
export class RelatorioModule { }
