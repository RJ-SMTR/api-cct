import { Logger } from "@nestjs/common";
import { asJSONStrOrObj } from "./pipe-utils";


/**
 * Run logger.debug() with formatted content.
 */
export function logDebug(
  logger: Logger | Console,
  log: string,
  context?: string,
  outerContext?: string,
) {
  logger.debug(formatLog(log, 'DEBUG', context, outerContext));
}

function isLocal() {
  return ['local', 'development'].includes(process.env.NODE_ENV || '');
}

export function getLogger(injectLogger: Logger | Console) {
  return isLocal() ? console : injectLogger;
}

/**
 * Run logger.log() with formatted content.
 */
export function logLog(
  logger: Logger | Console,
  log: string,
  context?: string,
  outerContext?: string,
) {

  const _logger = getLogger(logger);
  _logger.log(formatLog(log, 'LOG', context, outerContext));
}

/**
 * Run logger.warn() with formatted content.
 */
export function logWarn(
  logger: Logger | Console,
  log: string,
  context?: string,
  outerContext?: string,
) {
  const _logger = getLogger(logger);
  _logger.warn(formatLog(log, 'WARN', context, outerContext));
}

/**
 * Run logger.error() with formatted content.
 */
export function logError(
  logger: Logger | Console,
  firstLine: string,
  context?: string,
  message?: object | string,
  traceback?: Error,
) {
  const _logger = getLogger(logger);
  _logger.error(formatError(firstLine, message, traceback, context));
}


/**
 * Format log content for log, debug and warn.
 */
export function formatLog(
  log: string,
  logLevel: 'DEBUG' | 'LOG' | 'WARN' | 'ERROR',
  context?: string,
  outerContext?: string,
) {
  let startLog = `${context}`;
  if (context) {
    if (outerContext) {
      startLog = `${context} [from ${outerContext}]`;
    }
    startLog = `${startLog}: `;
  } else {
    startLog = '';
  }
  if (isLocal()) {
    startLog = `[Nest] ${logLevel} - ${startLog}: `
  }
  return startLog + log;
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
    formattedString = formatLog(formattedString, 'ERROR', context);
  }
  return formattedString;
}

export function getLogFromError(error: any) {
  return JSON.stringify({
    message: (error as Error)?.message,
    traceback: (error as Error)?.stack,
  })
}
