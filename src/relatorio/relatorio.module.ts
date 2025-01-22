import { Module } from '@nestjs/common';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { CnabModule } from 'src/cnab/cnab.module';
import { RelatorioConsolidadoRepository } from './relatorio-consolidado.repository';
import { RelatorioSinteticoRepository } from './relatorio-sintetico.repository';
import { RelatorioAnaliticoRepository } from './relatorio-analitico.repository';
import { RelatorioNovoRemessaService } from './relatorio-novo-remessa.service';
import { RelatorioNovoRemessaController } from './relatorio-novo-remessa.controller';
import { RelatorioNovoRemessaRepository } from './relatorio-novo-remessa.repository';


@Module({
  imports:[CnabModule],
  controllers: [RelatorioController, RelatorioNovoRemessaController],
  providers: [RelatorioService, RelatorioNovoRemessaService, RelatorioConsolidadoRepository,
    RelatorioSinteticoRepository,RelatorioAnaliticoRepository, RelatorioNovoRemessaRepository]
})
export class RelatorioModule {}
