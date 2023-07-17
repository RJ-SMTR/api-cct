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

interface RegexMapInterface {
  fullPhone?: string;
  countryGroup?: string;
  countryCode?: string;
  stateGroup?: string;
  stateCode?: string;
  mobileDigit?: string;
  phoneDigits?: string;
}

/**
 * Validates Brazillian phones.
 * The format must be a numeric or formatted string like '+xx(xx)9xxxx-xxxx'
 * @param value
 * @returns True if the value is a valid Brazilian phone.
 */
@ValidatorConstraint({ async: false })
export class IsPhoneBrConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const {
      countryCode = 'optional',
      stateCode = 'optional',
      mobileDigit = 'optional',
    }: IsPhoneOptions = args.constraints[0];

    const regexMasks = {
      numeric: `^(\\d{2})?(\\d{2})?(9)?(\\d{4})(\\d{4})$`,
      formatted: `^(\\+(\\d{2}))?(\\((\\d{2})\\))?(9)?(\\d{4})\\-(\\d{4})$`,
    };

    const regexResult = {
      clearNumeric: new RegExp(regexMasks.numeric).exec(
        value.replace(/[^\d]+/g, ''),
      ),
      numeric: new RegExp(regexMasks.numeric).exec(value),
      formatted: new RegExp(regexMasks.formatted).exec(value),
    };

    let resultMap: RegexMapInterface = {};
    if (
      regexResult.clearNumeric &&
      (regexResult.numeric || regexResult.formatted)
    ) {
      const result = regexResult.clearNumeric;
      resultMap = {
        fullPhone: result[0],
        countryCode: result[1],
        stateCode: result[2],
        mobileDigit: result[3],
        phoneDigits: result[4] + result[5],
      };
      if (!resultMap.stateCode && countryCode !== true) {
        resultMap = {
          ...resultMap,
          countryCode: resultMap.stateCode,
          stateCode: resultMap.countryCode,
        };
      }
    } else {
      return false;
    }

    let validations: any = {
      isCountryCodeValid:
        countryCode === 'optional' ||
        countryCode === Boolean(resultMap.countryCode),
      isStateCodeValid:
        stateCode === 'optional' || stateCode === Boolean(resultMap.stateCode),
      isMobileDigitValid:
        mobileDigit === 'optional' ||
        mobileDigit === Boolean(resultMap.mobileDigit),
    };
    validations = {
      ...validations,
      isDddValid:
        validations.isStateCodeValid &&
        Number(resultMap.stateCode) >= 11 &&
        Number(resultMap.stateCode) <= 99,
    };

    const isPhoneValid = Object.values(validations).every(
      (value) => value === true,
    );

    return isPhoneValid;
  }
  defaultMessage() {
    return 'invalidPhone';
  }
}

/**
 * Validates Brazillian phones.
 * The format must be numeric or formatted string like '+xx(xx)9xxxx-xxxx'
 * @param options set phone number parts as `'optional'`, `true` for mandatory or `false` for forbidden
 * @returns True if string is a valid brazillian phone.
 */
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
