import * as fs from 'fs';

/**
 * Automaticlaly generated JSON mock.
 */
const dirname: string = __dirname.replace(/\\/g, '/').replace('dist/', 'src/');
const filePath = `${dirname}/trips-income-response-mockup.json`;

export const tripsIncomeResponseMockup = fs.readFileSync(filePath, 'utf8');
