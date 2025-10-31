import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BigqueryModule } from 'src/client/bigquery/bigquery.module';
import appConfig from 'src/configuration/app.config';
import databaseConfig from 'src/configuration/database.config';
import googleConfig from 'src/configuration/google.config';
import mailConfig from 'src/configuration/mail.config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmConfigService } from '../typeorm-config.service';
import { BankSeedModule } from './bank/bank-seed.module';
import { ClienteFavorecidoSeedModule } from './cliente-favorecido/cliente-favorecido-seed.module';
import { InfoSeedModule } from './info/info-seed.module';
import { LancamentoSeedModule } from './lancamento/lancamento-seed.module';
import { MailCountSeedModule } from './mail-count/mail-count-seed.module';
import { InviteStatusSeedModule } from './mail-history-status/mail-history-status-seed.module';
import { MailHistorySeedModule } from './mail-history/mail-history-seed.module';
import { PagadorSeedModule } from './pagador/pagador-seed.module';
import { RoleSeedModule } from './role/role-seed.module';
import { SettingTypeSeedModule } from './setting-type/setting-type.module';
import { SettingSeedModule } from './setting/setting-seed.module';
import { StatusSeedModule } from './status/status-seed.module';
import { TransacaoStatusSeedModule } from './transacao-status/transacao-status-seed.module';
import { UserSeedModule } from './user/user-seed.module';

@Module({
  imports: [
    RoleSeedModule,
    TransacaoStatusSeedModule,
    StatusSeedModule,
    InfoSeedModule,
    BankSeedModule,
    InviteStatusSeedModule,
    SettingTypeSeedModule,
    SettingSeedModule,
    MailCountSeedModule,
    UserSeedModule,
    MailHistorySeedModule,
    BigqueryModule,
    PagadorSeedModule,
    ClienteFavorecidoSeedModule,
    LancamentoSeedModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig, mailConfig, googleConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    }),
  ],
})
export class SeedModule { }
