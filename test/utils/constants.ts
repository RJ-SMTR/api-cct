import { config } from 'dotenv';
config();

export const APP_URL = `http://localhost:${process.env.APP_PORT}`;
export const MAILDEV_URL = `http://${process.env.MAIL_HOST}:${process.env.MAIL_CLIENT_PORT}`;

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'secret';
export const ADMIN_2_EMAIL = 'admin2@example.com';
export const ADMIN_2_PASSWORD = 'secret';

export const TO_UPDATE_PERMIT_CODE = '319274392832025';

export const LICENSEE_CPF_EMAIL = 'henrique@example.com';
export const LICENSEE_CPF_PERMIT_CODE = '213890329890312';
export const LICENSEE_CPF_PASSWORD = 'secret';

export const LICENSEE_TEST_EMAIL = 'user@example.com';
export const LICENSEE_TEST_PERMIT_CODE = '213890329890749';
export const LICENSEE_CASE_ACCENT = 'Usuário Teste dos Santos Oliveira';

export const LICENSEE_CNPJ_EMAIL = 'marcia@example.com';
export const LICENSEE_CNPJ_PERMIT_CODE = '319274392832023';
export const LICENSEE_CNPJ_PASSWORD = 'secret';

export const LICENSEE_REGISTERED_EMAIL = 'registered.user@example.com';
export const LICENSEE_USED_EMAIL = 'used.user@example.com';
export const LICENSEE_SENT_EMAIL = 'sent.user@example.com';
export const LICENSEE_QUEUED_EMAIL = 'queued.user@example.com';

export const MAIL_HOST = process.env.MAIL_HOST;
export const MAIL_PORT = process.env.MAIL_CLIENT_PORT;

export const BQ_JSON_CREDENTIALS = () => {
  const credentials = {
    type: process.env.GOOGLE_CLIENT_API_TYPE,
    project_id: process.env.GOOGLE_CLIENT_API_PROJECT_ID,
    private_key_id: process.env.GOOGLE_CLIENT_API_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_CLIENT_API_PRIVATE_KEY,
    client_email: process.env.GOOGLE_CLIENT_API_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_API_CLIENT_ID,
    auth_uri: process.env.GOOGLE_CLIENT_API_AUTH_URI,
    token_uri: process.env.GOOGLE_CLIENT_API_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.GOOGLE_CLIENT_API_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_API_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_CLIENT_API_UNIVERSE_DOMAIN,
  };
  for (const [k, v] of Object.entries(credentials)) {
    credentials[k] = String(v).replace(/\\n/g, '\n');
  }
  return credentials;
};
