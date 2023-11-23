import { QueryBuildType } from './query-builder.type';

/**
 * Simple helper to make nested queries
 */
export class QueryBuilder {
  private queryBuild: QueryBuildType = [];

  constructor(queryBuild?: QueryBuildType) {
    if (queryBuild !== undefined) {
      this.setQueryBuild(queryBuild);
    }
  }

  public getQueryBuild(): QueryBuildType {
    return this.queryBuild;
  }

  public setQueryBuild(queryBuild: string[][]) {
    this.queryBuild = queryBuild;
  }

  public pushAND(condition: string, ORIndex = -1) {
    const orIndex = ORIndex >= 0 ? ORIndex : this.queryBuild.length + ORIndex;
    this.queryBuild[orIndex].push(condition);
  }

  public pushOR(conditions: string[]) {
    this.queryBuild.push(conditions);
  }

  /**
   *
   * @returns ```sql
   * (<condition> and <condition>) OR (<conditions...>)
   * ```
   */
  public toSQL(): string {
    if (!this.getQueryBuild()) {
      return '';
    }
    return this.queryBuild
      .filter((conditions) => conditions.length > 0)
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
