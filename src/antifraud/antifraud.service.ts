import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrdemPagamentoRepository,
  SuspiciousOrdemPagamento,
} from 'src/cnab/novo-remessa/repository/ordem-pagamento.repository';
import { AllConfigType } from 'src/config/config.type';
import { MailService } from 'src/mail/mail.service';
import { appSettings } from 'src/settings/app.settings';
import { SettingsService } from 'src/settings/settings.service';
import { validateEmail } from 'validations-br';

@Injectable()
export class AntifraudService {
  private readonly logger = new Logger(AntifraudService.name, {
    timestamp: true,
  });

  private static readonly TARGET_CONSORCIOS = ['STPC', 'STPL', 'TEC'];

  constructor(
    private readonly ordemPagamentoRepository: OrdemPagamentoRepository,
    private readonly mailService: MailService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService<AllConfigType>,
  ) { }

  async runAdminFraudAlertJob(): Promise<void> {
    const METHOD = this.runAdminFraudAlertJob.name;
    const jobReference = new Date();

    if (!(await this.isEnabled(METHOD))) {
      return;
    }

    const recipients = await this.getRecipients(METHOD);
    if (!recipients.length) {
      return;
    }

    const threshold = await this.getThreshold(METHOD);
    const lastExecution = await this.getLastExecution(METHOD);
    const orders =
      await this.ordemPagamentoRepository.findSuspiciousOrdersCreatedBetween(
        lastExecution,
        jobReference,
        threshold,
        AntifraudService.TARGET_CONSORCIOS,
      );
    const shouldBypassEmailSend = this.shouldBypassEmailSend();

    if (!orders.length) {
      this.logger.log(
        'Nenhuma ordem suspeita encontrada para o intervalo analisado.',
        METHOD,
      );
      if (shouldBypassEmailSend) {
        console.log('[ANTIFRAUD][LOCAL BYPASS] No suspicious orders found.');
        return;
      }
      await this.settingsService.upsertBySettingData(
        appSettings.any__mail_admin_fraud_last_execution,
        jobReference.toISOString(),
      );
      return;
    }

    if (shouldBypassEmailSend) {
      this.printLocalTestOutput(orders, recipients, threshold, jobReference);
      this.logger.log(
        'Ambiente local detectado. Envio de email e atualizacao do checkpoint ignorados para teste.',
        METHOD,
      );
      return;
    }

    const mailSentInfo = await this.mailService.sendAdminFraudAlert({
      to: recipients,
      data: this.buildMailPayload(orders, threshold, jobReference),
    });

    if (!mailSentInfo.success) {
      this.logger.error(
        `Email antifraude retornou erro SMTP: ${JSON.stringify(mailSentInfo.response)}`,
        undefined,
        METHOD,
      );
      return;
    }

    await this.settingsService.upsertBySettingData(
      appSettings.any__mail_admin_fraud_last_execution,
      jobReference.toISOString(),
    );
    this.logger.log(
      `Alerta antifraude enviado com sucesso para ${recipients.join(', ')}.`,
      METHOD,
    );
  }

  private async isEnabled(method: string): Promise<boolean> {
    const enabledSetting = await this.settingsService.getOneBySettingData(
      appSettings.any__mail_admin_fraud_enabled,
      true,
      method,
    );

    if (!enabledSetting.getValueAsBoolean()) {
      this.logger.log(
        `Tarefa cancelada pois '${appSettings.any__mail_admin_fraud_enabled.name}' = 'false'.`,
        method,
      );
      return false;
    }

    return true;
  }

  private async getRecipients(method: string): Promise<string[]> {
    const recipientSettings = await this.settingsService.findManyBySettingDataGroup(
      appSettings.any__mail_admin_fraud_recipient,
    );
    const recipients =
      recipientSettings.length > 0
        ? recipientSettings.map((setting) => setting.getValueAsString())
        : appSettings.any__mail_admin_fraud_recipient.data.map(
          (setting) => setting.value,
        );

    if (!recipients.length) {
      this.logger.error(
        'Tarefa cancelada pois nenhum destinatario antifraude foi configurado.',
        undefined,
        method,
      );
      return [];
    }

    if (recipients.some((email) => !validateEmail(email))) {
      this.logger.error(
        `Tarefa cancelada pois a configuracao de destinatarios antifraude contem email invalido: ${recipients.join(', ')}`,
        undefined,
        method,
      );
      return [];
    }

    return recipients;
  }

  private async getThreshold(method: string): Promise<number> {
    const thresholdSetting = await this.settingsService.getOneBySettingData(
      appSettings.any__mail_admin_fraud_threshold,
      true,
      method,
    );
    const threshold = Number(thresholdSetting.value);

    if (Number.isNaN(threshold)) {
      throw new Error(
        `Setting '${appSettings.any__mail_admin_fraud_threshold.name}' deve ser numerica.`,
      );
    }

    return threshold;
  }

  private async getLastExecution(method: string): Promise<Date> {
    const lastExecutionSetting = await this.settingsService.getOneBySettingData(
      appSettings.any__mail_admin_fraud_last_execution,
      true,
      method,
    );
    const lastExecution = new Date(lastExecutionSetting.value);

    if (Number.isNaN(lastExecution.getTime())) {
      this.logger.warn(
        `Data invalida em '${appSettings.any__mail_admin_fraud_last_execution.name}'. Usando data inicial padrao.`,
        method,
      );
      return new Date(appSettings.any__mail_admin_fraud_last_execution.value);
    }

    return lastExecution;
  }

  private buildMailPayload(
    orders: SuspiciousOrdemPagamento[],
    threshold: number,
    generatedAt: Date,
  ) {
    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    return {
      generatedAt: generatedAt.toISOString(),
      threshold: currencyFormatter.format(threshold),
      totalOrders: orders.length,
      totalValue: currencyFormatter.format(
        orders.reduce((sum, order) => sum + order.valor, 0),
      ),
      orders: orders.map((order) => ({
        id: order.id,
        idOrdemPagamento: order.idOrdemPagamento,
        nomeConsorcio: order.nomeConsorcio,
        nomeOperadora: order.nomeOperadora,
        valor: currencyFormatter.format(order.valor),
        dataOrdem: this.toIsoDate(order.dataOrdem),
        dataCaptura: order.dataCaptura
          ? new Date(order.dataCaptura).toISOString()
          : '-',
        createdAt: new Date(order.createdAt).toISOString(),
      })),
    };
  }

  private toIsoDate(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }

  private shouldBypassEmailSend(): boolean {
    const nodeEnv = this.configService.get('app.nodeEnv', { infer: true });
    const backendDomain = this.configService.get('app.backendDomain', {
      infer: true,
    });

    return (
      nodeEnv === 'local' ||
      nodeEnv === 'test' ||
      Boolean(backendDomain?.includes('localhost'))
    );
  }

  private printLocalTestOutput(
    orders: SuspiciousOrdemPagamento[],
    recipients: string[],
    threshold: number,
    generatedAt: Date,
  ): void {
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      idOrdemPagamento: order.idOrdemPagamento,
      nomeConsorcio: order.nomeConsorcio,
      nomeOperadora: order.nomeOperadora,
      valor: order.valor,
      dataOrdem: this.toIsoDate(order.dataOrdem),
      dataCaptura: order.dataCaptura
        ? new Date(order.dataCaptura).toISOString()
        : null,
      createdAt: new Date(order.createdAt).toISOString(),
    }));

    console.log('[ANTIFRAUD][LOCAL BYPASS] Email send skipped.');
    console.log('[ANTIFRAUD][LOCAL BYPASS] Recipients:', recipients);
    console.log('[ANTIFRAUD][LOCAL BYPASS] Threshold:', threshold);
    console.log(
      '[ANTIFRAUD][LOCAL BYPASS] Generated at:',
      generatedAt.toISOString(),
    );
    console.log(
      '[ANTIFRAUD][LOCAL BYPASS] Orders payload:',
      JSON.stringify(formattedOrders, null, 2),
    );
  }
}
