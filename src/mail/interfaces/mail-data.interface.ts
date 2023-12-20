import { Address } from '@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface';

export interface MailData<T = never> {
  to: string | Address | Array<string | Address>;
  data: T;
}
