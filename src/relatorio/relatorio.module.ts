import { Module } from '@nestjs/common';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { CnabModule } from 'src/cnab/cnab.module';
import { RelatorioConsolidadoRepository } from './relatorio-consolidado.repository';
import { RelatorioSinteticoRepository } from './relatorio-sintetico.repository';
import { RelatorioAnaliticoRepository } from './relatorio-analitico.repository';


@Module({
  imports:[CnabModule],
  controllers: [RelatorioController],
  providers: [RelatorioService, RelatorioConsolidadoRepository,
    RelatorioSinteticoRepository,RelatorioAnaliticoRepository]
})
export class RelatorioModule {}
