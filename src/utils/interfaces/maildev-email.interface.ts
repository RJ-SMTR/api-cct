export interface IMaildevAddr {
  address: string;
  name: string;
}

export interface IMaildevEnvelopeAddr {
  address: string;
  args: boolean;
}

export interface IMaildevEmail {
  html: string;
  text: string;
  headers: {
    'content-type': string;
    /** @example "Api <noreply@example.com>"*/
    from: string;
    /** @example "queued.user@example.com" */
    to: string;
    subject: string;
    'message-id': string;
    /** @example "Thu, 08 Feb 2024 21:30:39 +0000" */
    date: string;
    'mime-version': string;
  };
  subject: string;
  messageId: string;
  priority: string;
  from: IMaildevAddr[];
  to: IMaildevAddr[];
  date: string;
  id: string;
  time: string;
  read: boolean;
  envelope: {
    from: IMaildevEnvelopeAddr;
    to: IMaildevEnvelopeAddr[];
    host: string;
    remoteAddress: string;
  };
  source: string;
  size: number;
  /** @example "2.82 KB" */
  sizeHuman: string;
  attachments: any[] | null;
  calculatedBcc: any[];
}
