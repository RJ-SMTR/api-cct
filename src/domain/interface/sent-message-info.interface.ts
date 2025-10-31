// import { SentMessageInfo as NodeMailerSentMessageInfo } from 'nodemailer';

/**
 * To represent original `SentMessageInfo` form nodemailer
 * @see {@link https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/nodemailer/index.d.ts#L24 nodemailer - GitHub}
 */
export interface MySentMessageInfo {
  accepted: string[];
  rejected: string[];
  ehlo: string[];
  envelopeTime: number;
  messageTime: number;
  messageSize: number;
  response: string;
  envelope: {
    from: string;
    to: string[];
  };
  messageId: string;
}
