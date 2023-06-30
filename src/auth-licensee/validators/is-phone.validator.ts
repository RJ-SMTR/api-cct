import {
  registerDecorator,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface IsPhoneOptions {
  countryCode?: boolean | 'optional';
  stateCode?: boolean | 'optional';
  mobileDigit?: boolean | 'optional';
}

@ValidatorConstraint({ async: false })
export class IsPhoneBrConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const {
      countryCode = 'optional',
      stateCode = 'optional',
      mobileDigit = 'optional',
    }: IsPhoneOptions = args.constraints[0];
    const regex = `^(\\+(\\d{2})\\s?\\((\\d{2})\\)\\s?(9)(\\d{4})\\-(\\d{4}))$|^(((\\d{2})?)((\\d{2})?)((9)?)(\\d{4})(\\d{4}))$`;

    const regExp = new RegExp(regex);
    const regexResult = regExp.exec(value);
    if (regexResult === null) {
      return false;
    }

    const matches = {
      fullPhone: value,
      countryCode:
        regexResult[3] ||
        (countryCode === true && (regexResult[11] || stateCode === false))
          ? regexResult[9]
          : '',
      stateCode:
        regexResult[4] ||
        (countryCode === true && regexResult[11]) ||
        regexResult[9],
      mobileDigit: regexResult[5] || regexResult[13],
      phoneDigits:
        (regexResult[6] && regexResult[7] && regexResult[6] + regexResult[7]) ||
        regexResult[14] + regexResult[15],
    };

    const isCountryCodeValid = !(countryCode === false && matches.countryCode);
    const isStateCodeValid = !(stateCode === false && matches.stateCode);
    const isDddValid =
      isStateCodeValid &&
      Number(matches.stateCode) >= 11 &&
      Number(matches.stateCode) <= 99;
    const isMobileDigitValid = !(mobileDigit === false && matches.mobileDigit);

    const isPhoneValid =
      isCountryCodeValid &&
      isStateCodeValid &&
      isDddValid &&
      isMobileDigitValid;

    return isPhoneValid;
  }
  defaultMessage() {
    return 'invalidPhone';
  }
}

export function IsPhoneBr(options?: IsPhoneOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      constraints: [options || {}],
      validator: IsPhoneBrConstraint,
    });
  };
}
