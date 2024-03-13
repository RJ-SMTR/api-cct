import { validateCNPJ, validateCPF } from "validations-br";

export function isCpfOrCnpj(cpfCnpj?: string) {
  if (!cpfCnpj) {
    return null;
  } else if (validateCPF(cpfCnpj)) {
    return 'cpf';
  } else if (validateCNPJ(cpfCnpj)) {
    return 'cnpj';
  } else {
    return null;
  }
}
