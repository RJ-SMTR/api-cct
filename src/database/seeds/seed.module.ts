import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from 'src/config/app.config';
import databaseConfig from 'src/config/database.config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmConfigService } from '../typeorm-config.service';
import { RoleSeedModule } from './role/role-seed.module';
import { StatusSeedModule } from './status/status-seed.module';
import { UserSeedModule } from './user/user-seed.module';
import { InfoSeedModule } from './info/info-seed.module';
import { BankSeedModule } from './bank/bank-seed.module';
import { InviteStatusSeedModule } from './mail-history-status/mail-history-status-seed.module';
import { SettingTypeSeedModule } from './setting-type/setting-type.module';
import { SettingSeedModule } from './setting/setting-seed.module';
import { MailCountSeedModule } from './mail-count/mail-count-seed.module';
import mailConfig from 'src/config/mail.config';
import { MailHistorySeedModule } from './mail-history/mail-history-seed.module';

@Module({
  imports: [
    RoleSeedModule,
    StatusSeedModule,
    UserSeedModule,
    InfoSeedModule,
    BankSeedModule,
    InviteStatusSeedModule,
    SettingTypeSeedModule,
    SettingSeedModule,
    MailCountSeedModule,
    UserSeedModule,
    MailHistorySeedModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig, mailConfig],
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
