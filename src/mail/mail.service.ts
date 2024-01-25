import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { AllConfigType } from 'src/config/config.type';
import { IMailHistoryStatusCount } from 'src/mail-history-statuses/interfaces/mail-history-status-group.interface';
import { SmtpStatus } from 'src/utils/enums/smtp-status.enum';
import { formatLog } from 'src/utils/logging';
import { MaybeType } from '../utils/types/maybe.type';
import { EhloStatus } from './enums/ehlo-status.enum';
import { MailData } from './interfaces/mail-data.interface';
import { MailRegistrationInterface } from './interfaces/mail-registration.interface';
import { MailSentInfo } from './interfaces/mail-sent-info.interface';
import { MySentMessageInfo } from './interfaces/nodemailer/sent-message-info';

@Injectable()
export class MailService {
  private logger = new Logger('MailService', { timestamp: true });

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private getMailSentInfo(sentMessageInfo: MySentMessageInfo): MailSentInfo {
    const code = Number(sentMessageInfo.response?.split(' ')?.[0] || '0');
    return {
      ...sentMessageInfo,
      ehlo: sentMessageInfo.ehlo as EhloStatus[],
      response: {
        code,
        message: sentMessageInfo.response,
      },
      success: code === SmtpStatus.COMPLETED,
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
  async sendConcludeRegistration(
    mailData: MailData<{ hash: string; userName: string }>,
  ): Promise<MailRegistrationInterface> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle] = await Promise.all([i18n.t('common.confirmEmail')]);
    } else {
      [emailConfirmTitle] = ['Confirme seu email'];
      this.logger.warn(
        formatLog(
          'módulo i18n não encontrou templates de email, usando valores padrão',
          'userConcludeRegistration()',
        ),
      );
    }

    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const emailConfirmLink = `${frontendDomain}conclude-registration/${mailData.data.hash}`;
    if (!mailData.data.userName) {
      this.logger.warn(
        formatLog(
          'user.fullName não encontrado, usando nome padrão.',
          'userConcludeRegistration()',
        ),
      );
    }
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
  async sendForgotPassword(
    mailData: MailData<{ hash: string }>,
  ): Promise<MailSentInfo> {
    const mailTitle = 'Redefinir senha';

    try {
      const frontendDomain = this.configService.get('app.frontendDomain', {
        infer: true,
      });
      const response = await this.safeSendMail({
        to: mailData.to,
        subject: mailTitle,
        text: `${this.configService.get('app.frontendDomain', {
          infer: true,
        })}reset-password/${mailData.data.hash} ${mailTitle}`,
        template: 'reset-password',
        context: {
          title: mailTitle,
          url: `${this.configService.get('app.frontendDomain', {
            infer: true,
          })}reset-password/${mailData.data.hash}`,
          actionTitle: mailTitle,
          logoSrc: `${frontendDomain}/assets/icons/logoPrefeitura.png`,
          logoAlt: 'Prefeitura do Rio',
          bodyText: 'Redefina sua senha clicando no botão abaixo!',
          buttonText: 'Redefinir senha.',
          footerText: 'Caso você não tenha solicitado este email, ignore.',
        },
      });

      return response;
    } catch (httpException) {
      throw httpException;
    }
  }

  /**
   * @throws `HttpException`
   */
  async sendStatusReport(
    mailData: MailData<{
      statusCount: IMailHistoryStatusCount;
    }>,
  ): Promise<MailSentInfo> {
    const mailTitle = 'Relatório diário';
    const from = this.configService.get('mail.senderNotification', {
      infer: true,
    });

    if (!from) {
      throw new HttpException(
        {
          error: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            env: `Env 'MAIL_SENDER_NOTIFICATION' not found (got: '${from}')`,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const appName = this.configService.get('app.name', {
        infer: true,
      });
      const response = await this.safeSendMail({
        from,
        to: mailData.to,
        subject: mailTitle,
        text: mailTitle,
        template: 'report',
        context: {
          title: mailTitle,
          headerTitle: appName,
          mailQueued: mailData.data.statusCount.queued,
          mailSent: mailData.data.statusCount.sent,
          mailUsed: mailData.data.statusCount.used,
          mailUsedIncomplete: mailData.data.statusCount.usedIncomplete,
          mailUsedComplete: mailData.data.statusCount.usedComplete,
          mailTotal: mailData.data.statusCount.total,
        },
      });

      return response;
    } catch (httpException) {
      throw httpException;
    }
  }

  /**
   * @throws `HttpException`
   */
  async reSendEmailBank(mailData: MailData<null>): Promise<MailSentInfo> {
    const mailTitle =
      'SMTR - Prefeitura do Município do Rio de Janeiro - Comunicado Importante!';
    const from = this.configService.get('mail.senderNotification', {
      infer: true,
    });
    if (!from) {
      throw new HttpException(
        {
          error: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            env: `Env 'MAIL_SENDER_NOTIFICATION' not found (got: '${from}')`,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    let to = mailData.to;
    to = 'bernardo.marcos64@gmail.com';

    try {
      const appName = this.configService.get('app.name', {
        infer: true,
      });
      const response = await this.safeSendMail({
        from,
        to, // to: mailData.to,
        subject: mailTitle,
        text: mailTitle,
        template: 'report_resent_email',
        context: {
          title: 'Confirme seu email',
          headerTitle: appName,
        },
      });

      return response;
    } catch (httpException) {
      throw httpException;
    }
  }
}
