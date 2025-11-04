import * as fs from 'fs';
import { BankDataInterface } from 'src/domain/interface/bank-data.interface';

/**
 * @see {@link https://brasilapi.com.br/docs#tag/BANKS brasilapi/banks}
 */
const filePath = `${__dirname}/data/bank-data.json`;

const bankDataJson = fs.readFileSync(filePath, 'utf8');
const bankDataObject = JSON.parse(bankDataJson);

export const bankData: BankDataInterface[] = bankDataObject.map(
  (item: any) =>
    item !== undefined &&
    Object.values(item).every((v) => v !== null && v !== undefined) && {
      ispb: item.ispb,
      name: item.name,
      code: item.code,
      fullName: item.fullName,
    },
);
