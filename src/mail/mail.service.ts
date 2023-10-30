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
import { MailCountService } from 'src/mail-count/mail-count.service';

@Injectable()
export class MailService {
  private logger = new Logger('MailService', { timestamp: true });

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private mailCountService: MailCountService,
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
    mailData: MailData<{ hash: string; userName: string }>,
  ): Promise<MailRegistrationInterface> {
    const senders = await this.mailCountService.getUpdatedMailCounts(true);
    if (senders.length === 0) {
      throw new HttpException(
        {
          error: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Mailing service is unavailable. Wait 24 hours and try again.',
          details: {
            error: 'quotaLimitReached',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle] = await Promise.all([i18n.t('common.confirmEmail')]);
    } else {
      [emailConfirmTitle] = ['Confirme seu email'];
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
          logoSrc: `${frontendDomain}/assets/icons/logoPrefeitura.png`,
          logoAlt: 'Prefeitura do Rio',
          userName: mailData.data.userName || 'cidadão',
          supportLink:
            'https://secretariamunicipaldetransportes.movidesk.com/form/6594/',
          actionTitle: emailConfirmTitle,
          url: emailConfirmLink,
        },
      });

      await this.mailCountService.update(senders[0].id, {
        recipientCount: senders[0].recipientCount + 1,
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
    const senders = await this.mailCountService.getUpdatedMailCounts(true);
    if (senders.length === 0) {
      throw new HttpException(
        {
          error: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Mailing service is unavailable. Wait 24 hours and try again.',
          details: {
            error: 'quotaLimitReached',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

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
      const response = await this.safeSendMail({
        to: mailData.to,
        subject: resetPasswordTitle,
        text: `${this.configService.get('app.frontendDomain', {
          infer: true,
        })}reset-password/${mailData.data.hash} ${resetPasswordTitle}`,
        template: 'reset-password',
        context: {
          title: resetPasswordTitle,
          url: `${this.configService.get('app.frontendDomain', {
            infer: true,
          })}reset-password/${mailData.data.hash}`,
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

      await this.mailCountService.update(senders[0].id, {
        recipientCount: senders[0].recipientCount + 1,
      });

      return response;
    } catch (httpException) {
      throw httpException;
    }
  }
}
