import { Module } from '@nestjs/common';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { CnabModule } from 'src/cnab/cnab.module';
import { RelatorioRepository } from './relatorio.repository';

@Module({
  imports:[CnabModule],
  controllers: [RelatorioController],
  providers: [RelatorioService, RelatorioRepository]
})
export class RelatorioModule {}
