import { config } from 'dotenv';
import { resolve } from 'path';

export function testGetBigqueryCredentials() {
  return {
    'google.clientApiType': process.env.GOOGLE_CLIENT_API_TYPE,
    'google.clientApiProjectId': process.env.GOOGLE_CLIENT_API_PROJECT_ID,
    'google.clientApiPrivateKeyId':
      process.env.GOOGLE_CLIENT_API_PRIVATE_KEY_ID,
    'google.clientApiPrivateKey': process.env.GOOGLE_CLIENT_API_PRIVATE_KEY,
    'google.clientApiClientEmail': process.env.GOOGLE_CLIENT_API_CLIENT_EMAIL,
    'google.clientApiClientId': process.env.GOOGLE_CLIENT_API_CLIENT_ID,
    'google.clientApiAuthUri': process.env.GOOGLE_CLIENT_API_AUTH_URI,
    'google.clientApiTokenUri': process.env.GOOGLE_CLIENT_API_TOKEN_URI,
    'google.clientApiAuthProviderX509CertUrl':
      process.env.GOOGLE_CLIENT_API_AUTH_PROVIDER_X509_CERT_URL,
    'google.clientApiClientX509CertUrl':
      process.env.GOOGLE_CLIENT_API_CLIENT_X509_CERT_URL,
    'google.clientApiUniverseDomain':
      process.env.GOOGLE_CLIENT_API_UNIVERSE_DOMAIN,
  };
}

export function testLoadEnv() {
  const envPath = resolve(__dirname, '../../.env');
  config({ path: envPath });
}
