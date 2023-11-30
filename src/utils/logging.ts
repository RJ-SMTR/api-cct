export function formatLog(
  log: string,
  context: string,
  outerContext?: string,
): string {
  let startLog = `${context}`;
  if (outerContext) {
    startLog = `${context} [from ${outerContext}]`;
  }
  return `${startLog}: ${log}`;
}

export function formatErrorMessage(
  firstLine: string,
  message: object,
  traceback: Error,
  context?: string,
): string {
  let formattedString =
    `${firstLine}` +
    `\n    - Message: ${JSON.stringify(message)}` +
    `\n    - Traceback:\n ${traceback.stack}`;
  if (context) {
    formattedString = formatLog(formattedString, context);
  }
  return formattedString;
}

if (require.main === module) {
  console.log(formatErrorMessage('mensagem', {}, new Error()));
}
