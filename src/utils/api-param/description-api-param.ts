/**
 * Return markdown formatted description from object
 */
export function ApiDescription(args: any): string {
  const desc: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (key.toLowerCase() == 'description' || key == '_') {
      desc.push(String(value));
    } else {
      desc.push(`_${key.slice(0, 1).toUpperCase() + key.slice(1)}_ : ${value}`);
    }
  }
  return desc.join('\n\n');
}
