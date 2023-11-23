import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface IsPhoneOptions {
  countryCode?: boolean | 'optional';
  stateCode?: boolean | 'optional';
  mobileDigit?: boolean | 'optional';
  numeric?: boolean | 'optional';
  mandatory?: boolean;
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
  private validations: any = {};

  validate(value: any, args: ValidationArguments) {
    const valueStr = String(value);
    const {
      countryCode = 'optional',
      stateCode = 'optional',
      mobileDigit = 'optional',
      numeric = 'optional',
      mandatory = false,
    }: IsPhoneOptions = args.constraints[0];

    if (value === undefined && !mandatory) {
      return true;
    }

    const regexMasks = {
      numeric: `^(\\d{2})?(\\d{2})?(9)?(\\d{4})(\\d{4})$`,
      formatted: `^(\\+(\\d{2}))?(\\((\\d{2})\\))?(9)?(\\d{4})\\-(\\d{4})$`,
    };

    const regexResult = {
      clearNumeric: new RegExp(regexMasks.numeric).exec(
        valueStr.replace(/[^\d]+/g, ''),
      ),
      numeric: new RegExp(regexMasks.numeric).exec(valueStr),
      formatted: new RegExp(regexMasks.formatted).exec(valueStr),
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
      matchesNumeric:
        numeric === 'optional' ||
        (numeric === true && regexResult.numeric !== null) ||
        (numeric === false && regexResult.formatted !== null),
    };
    validations = {
      ...validations,
      isDddValid:
        validations.isStateCodeValid &&
        Number(resultMap.stateCode) >= 11 &&
        Number(resultMap.stateCode) <= 99,
    };
    this.validations = validations;

    const isPhoneValid = Object.values(validations).every(
      (value) => value === true,
    );

    return isPhoneValid;
  }

  defaultMessage() {
    const falseKeys = Object.entries(this.validations)
      .filter((item) => item[1] === false)
      .map(([key]) => `${key}: false`);
    return `invalid phone - ${falseKeys.join(', ')}`;
  }
}

/**
 * Validates Brazillian phones.
 * The format must be numeric or formatted string like '+xx(xx)9xxxx-xxxx'
 * @param options set phone number parts as `'optional'`, `true` for mandatory or `false` for forbidden
 * @returns True if string is a valid brazillian phone.
 */
export function IsPhoneBr(
  options?: IsPhoneOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      constraints: [options || {}],
      options: validationOptions,
      validator: IsPhoneBrConstraint,
    });
  };
}
