import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { AllConfigType } from 'src/config/config.type';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { IMailHistoryStatusCount } from 'src/mail-history-statuses/interfaces/mail-history-status-group.interface';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { appSettings } from 'src/settings/app.settings';
import { SettingsService } from 'src/settings/settings.service';
import { SmtpStatus } from 'src/utils/enums/smtp-status.enum';
import { logWarn } from 'src/utils/log-utils';
import { MaybeType } from '../utils/types/maybe.type';
import { EhloStatus } from './enums/ehlo-status.enum';
import { MailData } from './interfaces/mail-data.interface';
import { MailRegistrationInterface } from './interfaces/mail-registration.interface';
import { MailSentInfo } from './interfaces/mail-sent-info.interface';
import { MySentMessageInfo } from './interfaces/nodemailer/sent-message-info';
import { validateEmail } from 'validations-br';

@Injectable()
export class MailService {
  private logger = new Logger('MailService', { timestamp: true });

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly settingsService: SettingsService,
    private readonly mailHistoryService: MailHistoryService,
  ) { }

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
      logWarn(this.logger,
        'módulo i18n não encontrou templates de email, usando valores padrão',
        'userConcludeRegistration()',
      );
    }

    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const emailConfirmLink = `${frontendDomain}conclude-registration/${mailData.data.hash}`;
    if (!mailData.data.userName) {
      logWarn(this.logger,
        'user.fullName não encontrado, usando nome padrão.',
        'userConcludeRegistration()',
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
      const response = await this.safeSendMail({
        from,
        to: mailData.to,
        subject: 'Projeto CCT - Atualização do relatório diário',
        text: mailTitle,
        template: 'report',
        context: {
          title: mailTitle,
          headerTitle: 'Estatística dos Dados',
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
  async sendAdminFraudAlert(
    mailData: MailData<{
      generatedAt: string;
      threshold: string;
      totalOrders: number;
      totalValue: string;
      orders: Array<{
        id: number;
        idOrdemPagamento: string | null;
        nomeConsorcio: string | null;
        nomeOperadora: string | null;
        valor: string;
        dataOrdem: string;
        dataCaptura: string;
        createdAt: string;
      }>;
    }>,
  ): Promise<MailSentInfo> {
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
      return await this.safeSendMail({
        from,
        to: mailData.to,
        subject: 'Projeto CCT - Alerta antifraude',
        text: `Alerta antifraude gerado em ${mailData.data.generatedAt}. ${mailData.data.totalOrders} ordem(ns) acima de ${mailData.data.threshold}.`,
        template: 'admin-fraud-alert',
        context: {
          title: 'Alerta antifraude',
          headerTitle: 'Alerta antifraude',
          generatedAt: mailData.data.generatedAt,
          threshold: mailData.data.threshold,
          totalOrders: mailData.data.totalOrders,
          totalValue: mailData.data.totalValue,
          orders: mailData.data.orders,
        },
      });
    } catch (httpException) {
      throw httpException;
    }
  }

  async runStatusReportJob(logger: Logger, METHOD: string): Promise<void> {
    logger.log('Iniciando tarefa.', METHOD);

    const isEnabled = await this.isStatusReportEnabled(logger, METHOD);
    if (!isEnabled) {
      return;
    }

    //Email que recebe o report        
    const emails = await this.getStatusReportRecipients(logger, METHOD);
    if (!emails) {
      return;
    }

    const body = await this.mailHistoryService.getStatusCount();

    if (!await this.verificaMudancaReport(JSON.stringify(body))) { //se não houver mudanças no report não envia
      return;
    }

    await this.sendStatusReportEmail(logger, emails, body, METHOD);
    logger.log('Tarefa finalizada.', METHOD);
  }

  private async isStatusReportEnabled(logger: Logger, METHOD: string): Promise<boolean> {
    const isEnabledFlag = await this.settingsService.findOneBySettingData(appSettings.any__mail_report_enabled);
    if (!isEnabledFlag) {
      logger.error(`Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' ` + 'não foi encontrado no banco.', undefined, METHOD);
      return false;
    }
    if (isEnabledFlag.getValueAsBoolean() === false) {
      logger.log(`Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` + ` Para ativar, altere na tabela 'setting'`, METHOD);
      return false;
    }
    return true;
  }

  private async getStatusReportRecipients(logger: Logger, METHOD: string): Promise<string[] | null> {
    const mailRecipients = await this.settingsService.findManyBySettingDataGroup(appSettings.any__mail_report_recipient);
    if (!mailRecipients) {
      logger.error(`Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` + ` não foi encontrada (retornou: ${mailRecipients}).`, undefined, METHOD);
      return null;
    }
    if (mailRecipients.some((i) => !validateEmail(i.getValueAsString()))) {
      logger.error(`Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` + ` não contém uma lista de emails válidos. Retornou: ${mailRecipients}.`, undefined, METHOD);
      return null;
    }
    return mailRecipients.reduce((l: string[], i) => [...l, i.getValueAsString()], []);
  }

  private async sendStatusReportEmail(logger: Logger, emails: string[], body: IMailHistoryStatusCount, METHOD: string): Promise<void> {
    try {
      const mailSentInfo = await this.sendStatusReport({
        to: emails,
        data: {
          statusCount: body,
        },
      } as any);

      // Success
      if (mailSentInfo.success === true) {
        logger.log(`Relatório enviado com sucesso para os emails ${emails}`, METHOD);
      }

      // SMTP error
      else {
        logger.error(`Relatório enviado para os emails ${emails} retornou erro. - ` + `mailSentInfo: ${JSON.stringify(mailSentInfo)}`, new Error().stack, METHOD);
      }
    } catch (httpException) {
      // API error
      logger.error(`Email falhou ao enviar para ${emails}`, httpException?.stack, METHOD);
    }
  }

  private async verificaMudancaReport(body: string | IMailHistoryStatusCount): Promise<boolean> {
    const sett = await this.settingsService.getOneByNameVersion('mail_report_send', '1')
    if ((body !== '' && body !== sett.value) || (sett.value==='')) {   
      await this.settingsService.update({ name: 'mail_report_send', version: '1', value: body.toString() })
      return true;
    }
    return false;
  }

  /**
   * @throws `HttpException`
   */
  async reSendEmailBank(
    mailData: MailData<{
      inviteStatus: InviteStatus;
      hash?: string;
    }>,
  ): Promise<MailSentInfo> {
    const mailTitle =
      'SMTR - Prefeitura do Município do Rio de Janeiro - Comunicado Importante!';
    const from = this.configService.get('mail.senderNotification', {
      infer: true,
    });
    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const inviteStatus = mailData.data.inviteStatus;
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
      const userLink =
        inviteStatus.id === InviteStatusEnum.used
          ? `${frontendDomain}sign-in`
          : `${frontendDomain}conclude-registration/${mailData.data.hash}`;
      const response = await this.safeSendMail({
        from,
        to: mailData.to,
        subject: mailTitle,
        text: `reminder-complete-registration ${userLink} ${mailTitle}`,
        template: 'user-daily-conclude',
        context: {
          title: 'Confirme seu email',
          userLink,
          headerTitle: appName,
        },
      });

      return response;
    } catch (httpException) {
      throw httpException;
    }
  }
}
