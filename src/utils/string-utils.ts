export function getStringUppercaseUnaccent(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function getStringNoSpecials(str: string) {
  return str.replace(/[^a-zA-Z ]/g, '');
}
