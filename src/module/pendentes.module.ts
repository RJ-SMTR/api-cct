import { Module } from '@nestjs/common';
import { CnabModule } from 'src/configuration/cnab/cnab.module';
import { CronJobsModule } from 'src/module/cron-jobs.module';
import { PendenteController } from '../controller/pagamento-pendente.controller';


@Module({
  imports: [CnabModule, CronJobsModule],
  controllers: [PendenteController],
  providers: []
})
export class PendentesModule { }
