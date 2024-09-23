import { Between, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { SqlDateOperator } from './interfaces/sql-date-operator.interface';
import { dateMonthToHumanMonth } from '../types/human-month.type';
import { EntityCondition } from '../types/entity-condition.type';

export function parseQBDateOperator<Entity extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<Entity>, //
  field: string,
  operator: SqlDateOperator,
  whereCount = 0,
): [SelectQueryBuilder<Entity>, number] {
  let qb = queryBuilder;
  if (operator.is) {
    qb = qb[!whereCount ? 'where' : 'andWhere']({ [field]: operator.is } as EntityCondition<ObjectLiteral>);
    whereCount += 1;
  }
  if (operator.between) {
    qb = qb[!whereCount ? 'where' : 'andWhere']({ [field]: Between(...operator.between) } as EntityCondition<ObjectLiteral>);
    whereCount += 1;
  }
  if (operator.year) {
    qb = qb[!whereCount ? 'where' : 'andWhere'](`EXTRACT(YEAR FROM ${field}) = :year`, { year: operator.year });
    whereCount += 1;
  }
  if (operator.month) {
    const month = dateMonthToHumanMonth(operator.month);
    qb = qb[!whereCount ? 'where' : 'andWhere'](`EXTRACT(MONTH FROM ${field}) = :month`, { month });
    whereCount += 1;
  }
  if (operator.day) {
    const [operation, day] = operator.day;
    qb = qb[!whereCount ? 'where' : 'andWhere'](`EXTRACT(DAY FROM ${field}) ${operation} :day`, { day });
    whereCount += 1;
  }
  return [qb, whereCount];
}
