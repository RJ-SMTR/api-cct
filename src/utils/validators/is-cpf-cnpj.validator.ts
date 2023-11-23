import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { validateCNPJ, validateCPF } from 'validations-br';

export interface IsCpfCnpjOptions {
  isCpf?: boolean | 'optional';
  isCnpj?: boolean | 'optional';
  numeric?: boolean | 'optional';
  mandatory?: boolean;
}

@ValidatorConstraint({ async: false })
export class IsCpfCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const {
      isCpf = 'optional',
      isCnpj = 'optional',
      numeric = 'optional',
      mandatory = false,
    } = args.constraints[0];

    if (value === undefined && !mandatory) {
      return true;
    }

    const isCpfValid =
      (validateCPF(value) && (isCpf === true || isCpf === 'optional')) ||
      (!validateCPF(value) && (isCpf === false || isCpf === 'optional'));
    const isCnpjValid =
      (validateCNPJ(value) && (isCnpj === true || isCnpj === 'optional')) ||
      (!validateCNPJ(value) && (isCnpj === false || isCnpj === 'optional'));
    const isNumericValid =
      (!isNaN(Number(value)) && (numeric === true || numeric === 'optional')) ||
      (isNaN(Number(value)) && (numeric === false || numeric === 'optional'));

    return isCpfValid && isCnpjValid && isNumericValid;
  }

  defaultMessage(args: ValidationArguments) {
    const { isCpf = 'optional', isCnpj = 'optional' } = args.constraints[0];

    const cpfCnpj: string[] = [];
    if (isCpf !== false) {
      cpfCnpj.push('CPF');
    }
    if (isCnpj !== false) {
      cpfCnpj.push('CNPJ');
    }

    return `${cpfCnpj.join('/')} inválido`;
  }
}

export function IsCpfCnpj(
  options?: IsCpfCnpjOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options || {}],
      validator: IsCpfCnpjConstraint,
    });
  };
}
