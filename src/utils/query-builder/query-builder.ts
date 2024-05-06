import { ANDCondition, ORCondition } from "./query-builder.type";

/**
 * Simple helper to make nested queries
 */
export class QueryBuilder {
  private queryBuild: ORCondition[] = [[]];

  constructor(queryBuild?: ORCondition[]) {
    if (queryBuild !== undefined) {
      this.setQueryBuild(queryBuild);
    }
  }

  public getQueryBuild(): ORCondition[] {
    return this.queryBuild;
  }

  public setQueryBuild(queryBuild: ORCondition[]) {
    this.queryBuild = queryBuild;
  }

  /**
   * Push new ANDCondition
   * 
   * @param ANDCondition New condition
   * @param ORIndex Default is last ORCondition index
   */
  public pushAND(ANDCondition: ANDCondition, ORIndex = -1) {
    const orIndex = ORIndex >= 0 ? ORIndex : this.queryBuild.length - 1;
    this.queryBuild[orIndex].push(ANDCondition);
  }

  /**
   * Create a new OR condition item
   */
  public pushOR(ORCondition: ORCondition = []) {
    this.queryBuild.push(ORCondition);
  }

  /**
   * Generate AND/OR conditoins to be used in WHERE.
   * 
   * @returns ```sql
   * (
   * ㅤㅤ 'condition'
   * ㅤㅤ AND 'condition'
   * )
   * OR
   * (
   * ㅤㅤ 'condition'
   * ㅤㅤ AND 'condition'
   * )
   * ```
   */
  public toSQL(): string {
    if (!this.getQueryBuild()) {
      return '';
    }
    const queryBuild = this.queryBuild.map(or => or.filter(and => and)).filter(or => or.length);
    return queryBuild
      .map((conditions, index) => {
        const joinedConditions = conditions.join(' AND ');
        return index === 0
          ? `(${joinedConditions})`
          : `OR (${joinedConditions})`;
      })
      .join(' ');
  }

  public hasQueryBuild(): boolean {
    return this.queryBuild.length > 0;
  }
}

