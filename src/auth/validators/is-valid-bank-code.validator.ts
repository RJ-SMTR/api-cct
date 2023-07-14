import {
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { bankCodesGoogleMockup } from '../data/bank-codes-google-mockup';
import { BankCodesMockupInterface } from '../interfaces/bank-codes-mockup.interface';

@ValidatorConstraint({ async: true })
export class IsValidBankCodeConstraint implements ValidatorConstraintInterface {
  async validate(value: string) {
    const bankCodesResponseObject = await JSON.parse(bankCodesGoogleMockup);
    const sgtuResponse: BankCodesMockupInterface[] =
      bankCodesResponseObject.data.map((item) => ({
        id: item.id,
        bankCode: item.codigo,
        bankName: item.nome,
        bankIpsbCode: item.ibspb,
      }));

    const filteredData = sgtuResponse.filter((item) => item.bankCode === value);

    if (filteredData.length === 1) {
      return true;
    } else {
      return false;
    }
  }
  defaultMessage() {
    return 'invalidBankCode';
  }
}

export function IsValidBankCode() {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      validator: IsValidBankCodeConstraint,
    });
  };
}
