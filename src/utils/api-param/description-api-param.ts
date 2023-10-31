/**
 * Return markdown formatted description from object
 */
export function DescriptionApiParam(args: any): string {
  const desc: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    desc.push(`_${key.slice(0, 1).toUpperCase() + key.slice(1)}_ : ${value}`);
  }
  return desc.join('\n\n');
}
