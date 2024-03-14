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
  message: object | string,
  traceback?: Error,
  context?: string,
): string {
  const strMsg =
    typeof message === 'string' ? message : JSON.stringify(message);
  let formattedString = `${firstLine}` + `\n    - Message: ${strMsg}`;
  if (traceback) {
    formattedString += `\n    - Traceback:\n ${traceback.stack}`;
  }
  if (context) {
    formattedString = formatLog(formattedString, context);
  }
  return formattedString;
}

export function getLogFromError(error: any) {
  return JSON.stringify({
    message: (error as Error)?.message,
    traceback: (error as Error)?.stack,
  });
}
