export function parseStringUpperUnaccent(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function getStringReplaceAccent(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getStringNoSpecials(str: string) {
  return str.replace(/[^a-zA-Z0-9 ]/g, '');
}

/**
 * Checks if string:
 * - Is not uppercase (e.g. "A", "E" etc);
 * - Is not accent (e.g. "á", "ê" etc);
 * - Has no specials (e.g "?", "!" etc).
 */
export function isStringBasicAlnumUpper(original: string) {
  const expected = parseStringUpperUnaccent(getStringNoSpecials(original));
  return original === expected;
}

function formatValues(template: string, values: any[]): string {
  return template.replace(/\$(\d+)/g, (_, index) => {
    const value = values[parseInt(index) - 1];
    return value !== undefined ? value : `$${index}`;
  });
}