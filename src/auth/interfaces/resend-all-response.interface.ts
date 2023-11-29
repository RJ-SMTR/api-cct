import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { DeepPartial } from 'typeorm';

export interface ISentData {
  mailHistory: DeepPartial<MailHistory>;
}

export interface IResendAllResponse {
  total: number;
  sent: number;
  failed: number;
  sentMailData: DeepPartial<MailHistory>[];
  failedMailData: DeepPartial<MailHistory>[];
}
