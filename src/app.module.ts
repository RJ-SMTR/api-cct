import { MailerModule } from '@nestjs-modules/mailer';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver } from 'nestjs-i18n';
import { I18nModule } from 'nestjs-i18n/dist/i18n.module';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuthAppleModule } from './security/auth-apple/auth-apple.module';
import { AuthFacebookModule } from './security/auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from './security/auth-google/auth-google.module';
import { AuthLicenseeModule } from './security/auth-licensee/auth-licensee.module';
import { AuthTwitterModule } from './security/auth-twitter/auth-twitter.module';
import { AuthModule } from './security/auth/auth.module';
import { BankStatementsModule } from './module/bank-statements.module';
import { BanksModule } from './module/banks.module';
import { BigqueryModule } from './client/bigquery/bigquery.module';
import { CnabModule } from './configuration/cnab/cnab.module';
import appConfig from './configuration/app.config';
import appleConfig from './configuration/apple.config';
import authConfig from './configuration/auth.config';
import { AllConfigType } from './configuration/config.type';
import databaseConfig from './configuration/database.config';
import facebookConfig from './configuration/facebook.config';
import fileConfig from './configuration/file.config';
import googleConfig from './configuration/google.config';
import mailConfig from './configuration/mail.config';
import sftpConfig from './configuration/sftp.config';
import twitterConfig from './configuration/twitter.config';
import { CronJobsModule } from './module/cron-jobs.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { FilesModule } from './module/files.module';
import { ForgotModule } from './module/forgot.module';
import { HomeModule } from './module/home.module';
import { InfoModule } from './module/info.module';
import { LancamentoModule } from './module/lancamento.module';
import { MailCountModule } from './module/mail-count.module';
import { MailHistoryModule } from './module/mail-history.module';
import { MailModule } from './module/mail.module';
import { SettingsModule } from './configuration/settings/settings.module';
import { SftpModule } from './configuration/sftp/sftp.module';
import { TestModule } from './test/test.module';
import { TicketRevenuesModule } from './module/ticket-revenues.module';
import { RelatorioModule } from './relatorio/relatorio.module';
import { AppService } from './app.service';
import { TransacaoViewModule } from './module/transacao-view.module';
import { UsersModule } from './module/users.module';
import { MailConfigService } from './service/mail-config.service';
import { TransacaoViewService } from './service/transacao-view.service';
import { AppLoggerMiddleware } from './utils/logger-middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig, //
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
        return new DataSource({
          ...options,
          // logging: true,
        }).initialize();
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
    RelatorioModule,
  ],
  providers: [TransacaoViewService, AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}
