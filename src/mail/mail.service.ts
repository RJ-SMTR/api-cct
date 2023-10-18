import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';
import { AllConfigType } from 'src/config/config.type';
import { MaybeType } from '../utils/types/maybe.type';
import { MailRegistrationInterface } from './interfaces/mail-registration.interface';
import { MailSentInfo as MailSentInfo } from './interfaces/mail-sent-info.interface';
import { SentMessageInfo } from './interfaces/nodemailer/sent-message-info';
import { EhloStatus } from './enums/ehlo-status.enum';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { Options } from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService implements OnModuleInit {
  private oAuth2Client: OAuth2Client;
  private logger = new Logger('MailService', { timestamp: true });

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  onModuleInit() {
    void (async () => {
      try {
        await this.setTransport();
      } catch (error) {
        this.logger.error(error);
        throw new Error(error);
      }
    })()
      .catch()
      .then()
      .finally();
  }

  private setTransport() {
    // Make sure you have all the required environment variables for your SMTP.
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.password');
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port');
    const secure = this.configService.get<boolean>('mail.secure'); // true for 465, false for other ports

    if (!user || !pass || !host || !port) {
      console.log({ user, pass, host, port, secure });
      this.logger.error('Mail environment variables are not fully set.');
      return;
    }

    const config: Options = {
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    };

    this.mailerService.addTransporter('smtp', config);
  }

  // private async setTransport() {
  //   const isMailEnvsDefined = [
  //     this.configService.get('mail.googleClientId', { infer: true }),
  //     this.configService.get('mail.googleClientSecret', { infer: true }),
  //     this.configService.get('mail.googleRefreshToken', { infer: true }),
  //     this.configService.get('mail.user', { infer: true }),
  //   ].every((i) => i !== undefined);
  //   if (!isMailEnvsDefined) {
  //     this.logger.warn(
  //       'setTransport(): Function aborted because needed mail envs are not defined in production. Bulk mail sending feature wont work in production!',
  //     );
  //     return;
  //   }
  //   const OAuth2 = google.auth.OAuth2;
  //   const oauth2Client = new OAuth2(
  //     this.configService.getOrThrow('mail.googleClientId', { infer: true }),
  //     this.configService.getOrThrow('mail.googleClientSecret', { infer: true }),
  //     'https://developers.google.com/oauthplayground',
  //   );

  //   oauth2Client.setCredentials({
  //     refresh_token: this.configService.getOrThrow('mail.googleRefreshToken', {
  //       infer: true,
  //     }),
  //   });

  //   console.log('credentials');
  //   console.log(oauth2Client);

  //   const accessToken: string = await new Promise((resolve, reject) => {
  //     oauth2Client.getAccessToken((err, token: string) => {
  //       if (err) {
  //         console.log('error');
  //         console.log(JSON.stringify(err));
  //         reject(err);
  //       }
  //       resolve(token);
  //     });
  //   });

  //   const config: Options = {
  //     service: 'gmail',
  //     auth: {
  //       type: 'OAuth2',
  //       user: this.configService.get('mail.user', { infer: true }),
  //       clientId: this.configService.getOrThrow('mail.googleClientId', {
  //         infer: true,
  //       }),
  //       clientSecret: this.configService.getOrThrow('mail.googleClientSecret', {
  //         infer: true,
  //       }),
  //       accessToken,
  //     },
  //   };
  //   this.mailerService.addTransporter('gmail', config);
  //   console.log({
  //     transporter: (this.mailerService as any).transporter,
  //     transporters: (this.mailerService as any).transporters,
  //   });
  // }

  private getMailSentInfo(sentMessageInfo: SentMessageInfo): MailSentInfo {
    return {
      ...sentMessageInfo,
      ehlo: sentMessageInfo.ehlo as EhloStatus[],
      response: {
        code: Number(sentMessageInfo.response?.split(' ')?.[0] || '0'),
        message: sentMessageInfo.response,
      },
    };
  }

  /**
   * @throws `HttpException`
   */
  private async safeSendMail(
    sendMailOptions: ISendMailOptions,
  ): Promise<MailSentInfo> {
    try {
      return this.getMailSentInfo(
        await this.mailerService.sendMail(sendMailOptions),
      );
    } catch (error) {
      throw new HttpException(
        {
          error: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            node: {
              message: String(error),
              ...error,
            },
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * @throws `HttpException`
   */
  async userConcludeRegistration(
    mailData: MailData<{ hash: string }>,
  ): Promise<MailRegistrationInterface> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-email.text1'),
        i18n.t('confirm-email.text2'),
        i18n.t('confirm-email.text3'),
      ]);
    } else {
      [emailConfirmTitle, text1, text2, text3] = [
        'Confirme seu email',
        'Olá!',
        'Você recebeu este convite para se inscrever neste serviço.',
        'Clique no botão abaixo para finalizar seu cadastro.',
      ];
      this.logger.warn(
        'userConcludeRegistration(): i18n module not found message templates, using default content',
      );
    }

    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const emailConfirmLink = `${frontendDomain}/confirm-email/${mailData.data.hash}`;

    try {
      const mailSentInfo = await this.safeSendMail({
        to: mailData.to,
        subject: emailConfirmTitle,
        text: `${emailConfirmLink} ${emailConfirmTitle}`,
        template: 'activation',
        context: {
          title: emailConfirmTitle,
          url: emailConfirmLink,
          actionTitle: emailConfirmTitle,
          app_name: this.configService.get('app.name', { infer: true }),
          text1,
          text2,
          text3,
        },
      });
      return {
        mailSentInfo: mailSentInfo,
        mailConfirmationLink: emailConfirmLink,
      };
    } catch (httpException) {
      throw httpException;
    }
  }

  /**
   * @throws `HttpException`
   */
  async forgotPassword(
    mailData: MailData<{ hash: string }>,
  ): Promise<MailSentInfo> {
    const i18n = I18nContext.current();
    let resetPasswordTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;
    let text4: MaybeType<string>;

    if (i18n) {
      [resetPasswordTitle, text1, text2, text3, text4] = await Promise.all([
        i18n.t('common.resetPassword'),
        i18n.t('reset-password.text1'),
        i18n.t('reset-password.text2'),
        i18n.t('reset-password.text3'),
        i18n.t('reset-password.text4'),
      ]);
    }

    try {
      return await this.safeSendMail({
        to: mailData.to,
        subject: resetPasswordTitle,
        text: `${this.configService.get('app.frontendDomain', {
          infer: true,
        })}/password-change/${mailData.data.hash} ${resetPasswordTitle}`,
        template: 'reset-password',
        context: {
          title: resetPasswordTitle,
          url: `${this.configService.get('app.frontendDomain', {
            infer: true,
          })}/password-change/${mailData.data.hash}`,
          actionTitle: resetPasswordTitle,
          app_name: this.configService.get('app.name', {
            infer: true,
          }),
          text1,
          text2,
          text3,
          text4,
        },
      });
    } catch (httpException) {
      throw httpException;
    }
  }
}
