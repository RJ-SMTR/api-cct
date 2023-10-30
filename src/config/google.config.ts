import { registerAs } from '@nestjs/config';
import { GoogleConfig } from './config.type';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from 'src/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  GOOGLE_CLIENT_API_TYPE: string;

  @IsString()
  GOOGLE_CLIENT_API_PROJECT_ID: string;

  @IsString()
  GOOGLE_CLIENT_API_PRIVATE_KEY_ID: string;

  @IsString()
  GOOGLE_CLIENT_API_PRIVATE_KEY: string;

  @IsString()
  GOOGLE_CLIENT_API_CLIENT_EMAIL: string;

  @IsString()
  GOOGLE_CLIENT_API_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_API_AUTH_URI: string;

  @IsString()
  GOOGLE_CLIENT_API_TOKEN_URI: string;

  @IsString()
  GOOGLE_CLIENT_API_AUTH_PROVIDER_X509_CERT_URL: string;

  @IsString()
  GOOGLE_CLIENT_API_CLIENT_X509_CERT_URL: string;

  @IsString()
  GOOGLE_CLIENT_API_UNIVERSE_DOMAIN: string;
}

export default registerAs<GoogleConfig>('google', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    clientApiType: process.env.GOOGLE_CLIENT_API_TYPE,
    clientApiProjectId: process.env.GOOGLE_CLIENT_API_PROJECT_ID,
    clientApiPrivateKeyId: process.env.GOOGLE_CLIENT_API_PRIVATE_KEY_ID,
    clientApiPrivateKey: process.env.GOOGLE_CLIENT_API_PRIVATE_KEY,
    clientApiClientEmail: process.env.GOOGLE_CLIENT_API_CLIENT_EMAIL,
    clientApiClientId: process.env.GOOGLE_CLIENT_API_CLIENT_ID,
    clientApiAuthUri: process.env.GOOGLE_CLIENT_API_AUTH_URI,
    clientApiTokenUri: process.env.GOOGLE_CLIENT_API_TOKEN_URI,
    clientApiAuthProviderX509CertUrl:
      process.env.GOOGLE_CLIENT_API_AUTH_PROVIDER_X509_CERT_URL,
    clientApiClientX509CertUrl:
      process.env.GOOGLE_CLIENT_API_CLIENT_X509_CERT_URL,
    clientApiUniverseDomain: process.env.GOOGLE_CLIENT_API_UNIVERSE_DOMAIN,
  };
});
