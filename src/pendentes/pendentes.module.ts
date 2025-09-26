import { Module } from '@nestjs/common';
import { CnabModule } from 'src/cnab/cnab.module';
import { CronJobsModule } from 'src/cron-jobs/cron-jobs.module';
import { PendenteController } from './pagamento-pendente.controller';


@Module({
  imports: [CnabModule, CronJobsModule],
  controllers: [PendenteController],
  providers: []
})
export class PendentesModule { }
