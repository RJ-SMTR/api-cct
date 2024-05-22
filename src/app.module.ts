import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver } from 'nestjs-i18n';
import { I18nModule } from 'nestjs-i18n/dist/i18n.module';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuthAppleModule } from './auth-apple/auth-apple.module';
import { AuthFacebookModule } from './auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from './auth-google/auth-google.module';
import { AuthLicenseeModule } from './auth-licensee/auth-licensee.module';
import { AuthTwitterModule } from './auth-twitter/auth-twitter.module';
import { AuthModule } from './auth/auth.module';
import { BankStatementsModule } from './bank-statements/bank-statements.module';
import { BanksModule } from './banks/banks.module';
import { BigqueryModule } from './bigquery/bigquery.module';
import { CnabModule } from './cnab/cnab.module';
import appConfig from './config/app.config';
import appleConfig from './config/apple.config';
import authConfig from './config/auth.config';
import { AllConfigType } from './config/config.type';
import databaseConfig from './config/database.config';
import facebookConfig from './config/facebook.config';
import fileConfig from './config/file.config';
import googleConfig from './config/google.config';
import mailConfig from './config/mail.config';
import sftpConfig from './config/sftp.config';
import twitterConfig from './config/twitter.config';
import { CronJobsModule } from './cron-jobs/cron-jobs.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { FilesModule } from './files/files.module';
import { ForgotModule } from './forgot/forgot.module';
import { HomeModule } from './home/home.module';
import { InfoModule } from './info/info.module';
import { LancamentoModule } from './lancamento/lancamento.module';
import { MailCountModule } from './mail-count/mail-count.module';
import { MailHistoryModule } from './mail-history/mail-history.module';
import { MailConfigService } from './mail/mail-config.service';
import { MailModule } from './mail/mail.module';
import { SettingsModule } from './settings/settings.module';
import { SftpModule } from './sftp/sftp.module';
import { TestModule } from './test/test.module';
import { TicketRevenuesModule } from './ticket-revenues/ticket-revenues.module';
import { UsersModule } from './users/users.module';
import { TransacaoViewService } from './transacao-bq/transacao-view.service';
import { TransacaoViewModule } from './transacao-bq/transacao-view.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        facebookConfig,
        googleConfig,
        twitterConfig,
        appleConfig,
        sftpConfig,
      ],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    }),
    MailerModule.forRootAsync({
      useClass: MailConfigService,
    }),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService) => {
            return [configService.get('app.headerLanguage')];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthTwitterModule,
    AuthAppleModule,
    ForgotModule,
    MailModule,
    HomeModule,
    InfoModule,
    AuthLicenseeModule,
    MailHistoryModule,
    BanksModule,
    BankStatementsModule,
    TicketRevenuesModule,
    SettingsModule,
    MailCountModule,
    CronJobsModule,
    BigqueryModule,
    LancamentoModule,
    TestModule,
    CnabModule,
    SftpModule,
    TransacaoViewModule,
  ],
  providers: [TransacaoViewService],
})
export class AppModule {}
