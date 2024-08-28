import { Chalk } from 'chalk';
// import chalk from 'chalk';
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const chalk: Chalk = require('chalk');
chalk.level = 1;

const SQL_WORDS = ['SELECT', 'AS ', 'WHERE', 'CAST', 'DATE', 'TIMESTAMP', 'VARCHAR', 'ASC', 'DESC', 'LEFT', 'RIGHT', 'INNER', 'STIRNG', 'FROM', 'ORDER', 'GROUP', 'BY', 'LIMIT', 'OFFSET', 'COUNT', 'AND', 'DISTINCT'];

const SQL_METHODS = ['COUNT'];

export function formatSqlTitle(str: string): string {
  return chalk.underline.gray(str);
}

export function formatSqlTitleFailed(str: string): string {
  return chalk.underline.red.underline(str);
}

export function formatSqlQuery(query: string): string {
  let newQuery = String(query);
  for (const keyword of SQL_WORDS) {
    newQuery = newQuery.replace(new RegExp(keyword, 'g'), chalk.blue(keyword));
  }
  for (const method of SQL_METHODS) {
    newQuery = newQuery.replace(new RegExp(method, 'g'), chalk.magenta(method));
  }
  return compactQuery(newQuery);
}

export function compactQuery(str: string): string {
  if (process.env.NODE_ENV != 'local' || process.env.COMPACT_QUERY == 'true') {
    let result = str
      .split('\n')
      .map((l) => l.split('--')[0].trim())
      .join('\n')
      .replace(/\n(\s +)(?=\S)/g, ' ')
      .replace(/\n+/gm, ' ')
      .trim();
    return result;
  } else {
    return str;
  }
}
