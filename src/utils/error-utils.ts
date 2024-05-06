export function isHttpException(value: any): boolean {
  return value?.message === 'HttpException' && typeof value?.status === 'number';
}
