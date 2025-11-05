import { MailSentInfo } from './mail-sent-info.interface';

export interface MailRegistrationInterface {
  mailSentInfo: MailSentInfo;
  mailConfirmationLink: string;
}
