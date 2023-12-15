import { config } from 'dotenv';
config();

export const APP_URL = `http://localhost:${process.env.APP_PORT}`;
export const MAILDEV_URL = `http://${process.env.MAIL_HOST}:${process.env.MAIL_CLIENT_PORT}`;

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'secret';
export const ADMIN_2_EMAIL = 'admin.test@example.com';
export const ADMIN_2_PASSWORD = 'secret';

export const LICENSEE_EMAIL = 'henrique@example.com';
export const LICENSEE_PERMIT_CODE = '213890329890312';
export const LICENSEE_PASSWORD = 'secret';
export const LICENSEE_CASE_ACCENT = 'Márcia Clara Template';

export const LICENSEE_2_EMAIL = 'marcia@example.com';
export const LICENSEE_2_PERMIT_CODE = '319274392832023';
export const LICENSEE_2_PASSWORD = 'secret';

export const MAIL_HOST = process.env.MAIL_HOST;
export const MAIL_PORT = process.env.MAIL_CLIENT_PORT;
