import { Injectable, Logger } from '@nestjs/common';
import { Chalk } from 'chalk';
import { addMinutes, format } from 'date-fns';
import { asJSONStrOrObj } from './pipe-utils';
// import chalk from 'chalk';
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const chalk: Chalk = require('chalk');
chalk.level = 1;

enum colors {
  red = '\x1b[31m', // Red
  yellow = '\x1b[38;2;119;122;0m', // Yellow
  magenta = '\x1b[38;2;188;5;188m', // Magenta
  green = '\x1b[38;2;0;136;0m', // Green
  blue = '\x1b[34m', // Blue
  reset = '\x1b[0m',
}

@Injectable()
export class CustomLogger extends Logger {
  private IS_LOCAL = undefined;
  private color(
    type: 'error' | 'warn' | 'debug' | 'level',
    message: string,
    level?: 'VERBOSE' | 'DEBUG' | 'LOG' | 'WARN' | 'ERROR',
    reset = true,
  ): string {
    let _default = 'log';
    if (level === 'WARN') {
      _default = 'warn';
    } else if (level === 'ERROR') {
      _default = 'error';
    } else if (level === 'DEBUG') {
      _default = 'debug';
    }

    const _type = type === 'level' ? _default : type;

    if (_type === 'error') {
      const eol = reset ? '' : colors.red;
      return chalk.red(message) + eol;
    } else if (_type === 'warn') {
      return chalk.yellow(message);
    } else if (_type === 'debug') {
      return chalk.magenta(message);
    } else {
      // log
      return chalk.green(message);
    }

    // Printing the text
    // return `${colors[_type]}${message}${colors.reset}`;
  }

  constructor(
    public readonly context: string,
    options?: {
      timestamp?: boolean;
    },
  ) {
    super(context, options);
  }

  private isLocal() {
    return (
      ['local', 'development'].includes(process.env.NODE_ENV || '') &&
      this.IS_LOCAL !== false
    );
  }

  private getContext(isLocal: boolean, context?: string) {
    if (!context) {
      return '';
    }
    const contextStr = this.color('warn', `[${context}]`);
    if (isLocal) {
      const thisContext = this.color('warn', `[${this.context}]`);
      return thisContext + (context ? ` ${contextStr}` : '');
    } else {
      return contextStr;
    }
  }

  private getTimestamp() {
    let now = new Date();
    now = addMinutes(now, global.__localTzOffset);
    const formattedTimestamp = format(now, 'dd/MM/yyyy, HH:mm:ss');
    return formattedTimestamp;
  }

  private getProcessId(): string {
    return process.pid.toString();
  }

  log(message: string, context?: string): void {
    if (this.isLocal()) {
      console.log(this.formatMessage(message, 'LOG', context));
    } else {
      super.log(this.formatMessage(message, 'LOG', context));
    }
  }

  error(message: string, stack?: string, context?: string): void {
    if (this.isLocal()) {
      console.log(this.formatMessage(message, 'ERROR', context, stack));
    } else {
      super.error(this.formatMessage(message, 'ERROR', context, stack));
    }
  }

  warn(message: string, context?: string): void {
    if (this.isLocal()) {
      console.log(this.formatMessage(message, 'WARN', context));
    } else {
      super.warn(this.formatMessage(message, 'WARN', context));
    }
  }

  debug(message: string, context?: string): void {
    if (this.isLocal()) {
      console.debug(this.formatMessage(message, 'DEBUG', context));
    } else {
      super.debug(this.formatMessage(message, 'DEBUG', context));
    }
  }

  verbose(message: string, context?: string): void {
    if (this.isLocal()) {
      console.debug(this.formatMessage(message, 'VERBOSE', context));
    } else {
      super.verbose(this.formatMessage(message, 'VERBOSE', context));
    }
  }

  private formatMessage(
    message: string,
    level: 'VERBOSE' | 'DEBUG' | 'LOG' | 'WARN' | 'ERROR',
    context?: string,
    stack?: string,
  ): string {
    const IS_LOCAL = this.isLocal();
    const nest = this.color('level', `[Nest] ${this.getProcessId()}`, level);
    const levelStr = this.color('level', level.padStart(7, ' '), level);
    const contextStr = this.getContext(IS_LOCAL, context);
    const timestampStr = this.options.timestamp
      ? this.color('level', ' - ', level) + this.getTimestamp() + ' '
      : '';
    // const details = (trace as any)?.response;
    // const stack = (trace as any)?.stack;
    let messageStr =
      level === 'ERROR' ? this.formatError(message, undefined, stack) : message;
    messageStr = this.color('level', messageStr, level, !(level === 'ERROR'));
    const formattedMessage = IS_LOCAL
      ? `${nest} ${timestampStr}${levelStr} ${contextStr} ${messageStr}`
      : `${contextStr} ${messageStr}`;
    return formattedMessage;
  }

  /**
   * Format log for error content.
   */
  private formatError(
    firstLine: string,
    message?: object | string,
    traceback?: string,
  ): string {
    let formattedString = firstLine;
    if (message) {
      formattedString += `\n${asJSONStrOrObj(message)}`;
    }
    if (traceback) {
      formattedString += `\n${traceback}`;
    }
    return formattedString;
  }
}
