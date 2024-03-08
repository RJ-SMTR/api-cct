export function isCpfOrCnpj(cpfCnpj?: string) {
  if (!cpfCnpj) {
    return null;
  } else if (cpfCnpj.length === 11) {
    return 'cpf';
  } else if (cpfCnpj.length === 14) {
    return 'cnpj';
  } else {
    return null;
  }
}
