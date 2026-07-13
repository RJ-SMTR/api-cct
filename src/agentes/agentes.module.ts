import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { User } from 'src/users/entities/user.entity';
import { UsersModule } from 'src/users/users.module';
import { AgentesController } from './agentes.controller';
import { AgentesBigqueryRepository } from './agentes-bigquery.repository';
import { AgentesRepository } from './agentes.repository';
import { AgentesSyncService } from './agentes-sync.service';
import { AgentesService } from './agentes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BigqueryModule,
    UsersModule,
    MailHistoryModule,
  ],
  controllers: [AgentesController],
  providers: [
    AgentesService,
    AgentesRepository,
    AgentesBigqueryRepository,
    AgentesSyncService,
  ],
  exports: [AgentesSyncService],
})
export class AgentesModule { }