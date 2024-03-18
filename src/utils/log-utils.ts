import { Logger } from "@nestjs/common";
import { asJSONStrOrObj } from "./pipe-utils";


/**
 * Run logger.debug() with formatted content.
 */
export function logDebug(
  logger: Logger,
  log: string,
  context: string,
  outerContext?: string,
) {
  logger.debug(formatLog(log, context, outerContext));
}

/**
 * Run logger.log() with formatted content.
 */
export function logLog(
  logger: Logger,
  log: string,
  context: string,
  outerContext?: string,
) {
  logger.log(formatLog(log, context, outerContext));
}

/**
 * Run logger.warn() with formatted content.
 */
export function logWarn(
  logger: Logger,
  log: string,
  context: string,
  outerContext?: string,
) {
  logger.warn(formatLog(log, context, outerContext));
}

/**
 * Run logger.error() with formatted content.
 */
export function logError(
  logger: Logger,
  firstLine: string,
  context?: string,
  message?: object | string,
  traceback?: Error,
) {
  logger.error(formatError(firstLine, message, traceback, context));
}


/**
 * Format log content for log, debug and warn.
 */
export function formatLog(
  log: string,
  context: string,
  outerContext?: string,
) {
  let startLog = `${context}`;
  if (outerContext) {
    startLog = `${context} [from ${outerContext}]`;
  }
  return `${startLog}: ${log}`;
}

/**
 * Format log for error content.
 */
export function formatError(
  firstLine: string,
  message?: object | string,
  traceback?: Error,
  context?: string,
): string {
  let formattedString = firstLine;
  if (message) {
    formattedString += `\n    - Message: ${asJSONStrOrObj(message)}`;
  }
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