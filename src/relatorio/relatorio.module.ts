import { Module } from '@nestjs/common';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { CnabModule } from 'src/cnab/cnab.module';
import { MailModule } from 'src/mail/mail.module';
import { UsersModule } from 'src/users/users.module';

import { RelatorioNovoRemessaController } from './novo-remessa/relatorio-novo-remessa.controller';
import { RelatorioNovoRemessaRepository } from './novo-remessa/relatorio-novo-remessa.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from './novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';
import { RelatorioAnaliticoRepository } from './analitico/relatorio-analitico.repository';
import { RelatorioConsolidadoRepository } from './consolidado/relatorio-consolidado.repository';
import { RelatorioSinteticoRepository } from './sintetico/relatorio-sintetico.repository';
import { RelatorioExtratoBancarioRepository } from './extrato-bancario/relatorio-extrato-bancario.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioNovoRemessaFinancialMovementRepository } from './movimentacao-financeira/relatorio-novo-remessa-financial-movement.repository';

@Module({
  imports: [CnabModule, MailModule, UsersModule],
  controllers: [RelatorioController, RelatorioNovoRemessaController],
  providers: [RelatorioService, RelatorioNovoRemessaService, RelatorioConsolidadoRepository,
    RelatorioSinteticoRepository, RelatorioAnaliticoRepository, RelatorioNovoRemessaRepository,
    RelatorioNovoRemessaConsolidadoRepository,
    RelatorioExtratoBancarioRepository,
    RelatorioNovoRemessaFinancialMovementRepository, RelatorioNovoRemessaFinancialMovementService]
})
export class RelatorioModule { }
