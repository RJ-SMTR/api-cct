import { validateCNPJ, validateCPF } from "validations-br";

export function isCpfOrCnpj(cpfCnpj?: string, validateOnlySize = false) {
  if (!cpfCnpj) {
    return null;
  } else if (validateCPF(cpfCnpj) || (validateOnlySize && cpfCnpj?.length === 11)) {
    return 'cpf';
  } else if (validateCNPJ(cpfCnpj) || (validateOnlySize && cpfCnpj?.length === 14)) {
    return 'cnpj';
  } else {
    return null;
  }
}
