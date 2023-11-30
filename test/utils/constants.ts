import { config } from 'dotenv';
config();

export const APP_URL = `http://localhost:${process.env.APP_PORT}`;
export const TESTER_EMAIL = 'john.doe@example.com';
export const TESTER_PASSWORD = 'secret';
export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'secret';
export const LICENSEE_PERMIT_CODE =
  process.env.TEST_LICENSEE_PERMIT_CODE || '213890329890312';
export const LICENSEE_PASSWORD = process.env.TEST_LICENSEE_PASSWORD || 'secret';
export const MAIL_HOST = process.env.MAIL_HOST;
export const MAIL_PORT = process.env.MAIL_CLIENT_PORT;
