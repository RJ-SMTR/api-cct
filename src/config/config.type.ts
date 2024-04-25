export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
};

export type AppleConfig = {
  appAudience: string[];
};

export type AuthConfig = {
  secret?: string;
  expires?: string;
};

export type DatabaseConfig = {
  url?: string;
  type?: string;
  host?: string;
  port?: number;
  password?: string;
  name?: string;
  username?: string;
  synchronize?: boolean;
  maxConnections: number;
  sslEnabled?: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  key?: string;
  cert?: string;
};

export type FacebookConfig = {
  appId?: string;
  appSecret?: string;
};

export type FileConfig = {
  driver: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  awsDefaultS3Bucket?: string;
  awsDefaultS3Url?: string;
  awsS3Region?: string;
  maxFileSize: number;
};

export type GoogleConfig = {
  clientId?: string;
  clientSecret?: string;
  clientApiType?: string;
  clientApiProjectId?: string;
  clientApiPrivateKeyId?: string;
  clientApiPrivateKey?: string;
  clientApiClientEmail?: string;
  clientApiClientId?: string;
  clientApiAuthUri?: string;
  clientApiTokenUri?: string;
  clientApiAuthProviderX509CertUrl?: string;
  clientApiClientX509CertUrl?: string;
  clientApiUniverseDomain?: string;
};

export type MailConfig = {
  port: number;
  host?: string;
  user?: string;
  password?: string;
  defaultEmail?: string;
  defaultName?: string;
  ignoreTLS: boolean;
  secure: boolean;
  requireTLS: boolean;
  senderNotification?: string;
};

export type TwitterConfig = {
  consumerKey?: string;
  consumerSecret?: string;
};

export type SftpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  rootFolder: string;
};

export type AllConfigType = {
  app: AppConfig;
  apple: AppleConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  facebook: FacebookConfig;
  file: FileConfig;
  google: GoogleConfig;
  mail: MailConfig;
  twitter: TwitterConfig;
  sftp: SftpConfig;
};
