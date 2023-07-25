import * as fs from 'fs';

/**
 * Automaticlaly generated JSON mock.
 */
const dirname: string = __dirname.replace(/\\/g, '/').replace('dist/', 'src/');
const filePath = `${dirname}/bank-statements-response-mockup.json`;

export const bankStatementsResponseMockup = fs.readFileSync(filePath, 'utf8');
