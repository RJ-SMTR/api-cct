import { EhloStatus } from '../enum/ehlo-status.enum';

/**
 * Improved version of `SentMessageInfo`
 * @see https://support.google.com/a/answer/3221692?hl=en
 */
export interface MailSentInfo {
  accepted: string[];
  rejected: string[];
  ehlo: EhloStatus[];
  envelopeTime: number;
  messageTime: number;
  messageSize: number;
  response: {
    code: number;
    message: string;
  };
  envelope: {
    from: string;
    to: string[];
  };
  messageId: string;
  success: boolean;
}
