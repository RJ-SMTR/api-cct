import { Chalk } from 'chalk';
// import chalk from 'chalk';
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const chalk: Chalk = require("chalk");
chalk.level = 1;

const SQL_WORDS = [
  'SELECT',
  'AS ',
  'WHERE',
  'CAST',
  'DATE',
  'ASC',
  'DESC',
  'LEFT',
  'RIGHT',
  'INNER',
  'STIRNG',
  'FROM',
  'ORDER',
  'GROUP',
  'BY',
  'LIMIT',
  'OFFSET',
  'COUNT',
  'AND',
  'DISTINCT',
];

const SQL_METHODS = [
  'COUNT'
];

export function formatSqlTitle(str: string): string {
  return chalk.underline.gray(str);
}

export function formatSqlTitleFailed(str: string): string {
  return chalk.underline.red.underline(str);
}

export function formatSqlQuery(str: string): string {
  let newStr = String(str);
  for (const keyword of SQL_WORDS) {
    newStr = newStr.replace(new RegExp(keyword, 'g'), chalk.blue(keyword));
  }
  for (const method of SQL_METHODS) {
    newStr = newStr.replace(new RegExp(method, 'g'), chalk.magenta(method));
  }
  return newStr;
}
