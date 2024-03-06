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
  traceback?: Error,
  context?: string,
): string {
  let formattedString =
    `${firstLine}` + `\n    - Message: ${JSON.stringify(message)}`;
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
  })
}