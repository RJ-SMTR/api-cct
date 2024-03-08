import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from 'src/config/app.config';
import databaseConfig from 'src/config/database.config';
import mailConfig from 'src/config/mail.config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmConfigService } from '../typeorm-config.service';
import { BankSeedModule } from './bank/bank-seed.module';
import { InfoSeedModule } from './info/info-seed.module';
import { MailCountSeedModule } from './mail-count/mail-count-seed.module';
import { InviteStatusSeedModule } from './mail-history-status/mail-history-status-seed.module';
import { MailHistorySeedModule } from './mail-history/mail-history-seed.module';
import { RoleSeedModule } from './role/role-seed.module';
import { SettingTypeSeedModule } from './setting-type/setting-type.module';
import { SettingSeedModule } from './setting/setting-seed.module';
import { StatusSeedModule } from './status/status-seed.module';
import { UserSeedModule } from './user/user-seed.module';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import googleConfig from 'src/config/google.config';

@Module({
  imports: [
    RoleSeedModule,
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
export class SeedModule {}
