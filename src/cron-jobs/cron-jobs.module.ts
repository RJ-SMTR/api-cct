import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AgendamentoPagamentoModule } from 'src/agendamento/agendamento.module';
import { CnabModule } from 'src/cnab/cnab.module';
import { MailCountModule } from 'src/mail-count/mail-count.module';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { MailModule } from 'src/mail/mail.module';
import { SettingsModule } from 'src/settings/settings.module';
import { SftpModule } from 'src/sftp/sftp.module';
import { UsersModule } from 'src/users/users.module';
import { CronJobsService } from './cron-jobs.service';
import { CronJobsManutencaoController } from './cron-jobs-manutencao.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    SettingsModule,
    MailHistoryModule,
    MailModule,
    UsersModule,
    MailCountModule,
    CnabModule,
    SftpModule,
    AgendamentoPagamentoModule
  ],
  controllers: [CronJobsManutencaoController],
  providers: [CronJobsService],
  exports: [CronJobsService],
})
export class CronJobsModule {}
