import { Exclude, instanceToPlain } from 'class-transformer';
import { isDate } from 'date-fns';
import { AfterLoad, BaseEntity, DeepPartial } from 'typeorm';

export class EntityHelper extends BaseEntity {
  @Exclude()
  __entity?: string;

  @AfterLoad()
  setEntityName() {
    this.__entity = this.constructor.name;
  }

  toJSON() {
    return instanceToPlain(this);
  }

  /**
   * For some reason, fields like 'time', 'decimal'
   * are received as string instead as Date, Number
   */
  @AfterLoad()
  setReadValues() {
    //
  }

  /**
   * Get unique ID.
   */
  public static getUniqueId(entity: DeepPartial<EntityHelper>): string {
    return `${entity}`;
  }

  public static getQueryFieldValues(dto: DeepPartial<EntityHelper>, fields: string[], types: string[]) {
    const query = fields
      .map((f, i) => {
        const value = dto[f];
        const _type = types[i];
        if (typeof value === 'string') {
          return `'${value}'`;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          return value;
        } else if (value === null) {
          return `NULL::${_type}`;
        } else if (isDate(new Date(value))) {
          return `'${new Date(value).toISOString()}'::${_type}`;
        } else {
          return value;
        }
      })
      .join(', ');
    return query;
  }
}
