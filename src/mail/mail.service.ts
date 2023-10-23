import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';
import { AllConfigType } from 'src/config/config.type';
import { MaybeType } from '../utils/types/maybe.type';
import { MailRegistrationInterface } from './interfaces/mail-registration.interface';
import { MailSentInfo as MailSentInfo } from './interfaces/mail-sent-info.interface';
import { MySentMessageInfo } from './interfaces/nodemailer/sent-message-info';
import { EhloStatus } from './enums/ehlo-status.enum';

@Injectable()
export class MailService {
  private logger = new Logger('MailService', { timestamp: true });

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private getMailSentInfo(sentMessageInfo: MySentMessageInfo): MailSentInfo {
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
        'userConcludeRegistration(): i18n module not found message templates, using default',
      );
    }

    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const emailConfirmLink = `${frontendDomain}conclude-registration/${mailData.data.hash}`;

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
