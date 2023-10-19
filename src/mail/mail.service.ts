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
import { Options } from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService implements OnModuleInit {
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
    const user = () => this.configService.get('mail.user', { infer: true });
    /** Gmail: less secure App password */
    const pass = () => this.configService.get('mail.password', { infer: true });
    const host = () => this.configService.get('mail.host', { infer: true });
    /** True for 465, false for other ports */
    const port = () => this.configService.get('mail.port', { infer: true });
    const secure = () => this.configService.get('mail.secure', { infer: true });

    if (!user() || !pass() || !host() || !port()) {
      this.logger.error(
        'setTransport(): Function aborted because mail environment variables are not fully set.',
      );
      return;
    }

    const config: Options = {
      host: host(),
      port: port(),
      secure: secure(),
      auth: {
        user: user(),
        pass: pass(),
      },
    };

    this.mailerService.addTransporter('smtp', config);
  }

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
      console.log('OPTIONS SEND EMAIL');
      console.log(sendMailOptions);
      return this.getMailSentInfo(
        await this.mailerService.sendMail(sendMailOptions),
      );
    } catch (error) {
      console.log(error);
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
        'userConcludeRegistration(): i18n module not found message templates, using default',
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
