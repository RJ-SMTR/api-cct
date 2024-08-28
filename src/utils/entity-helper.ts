import { Exclude, instanceToPlain } from 'class-transformer';
import { isDate } from 'date-fns';
import { Exception } from 'handlebars';
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

  public static getQueryFieldValues(dto: DeepPartial<EntityHelper>, fields: string[], types: string[]): string {
    const query = fields
      .map((f, i) => {
        const value = dto[f];
        const _type = types[i];
        if (value === undefined) {
          throw new Exception(`Value should be defined (field: ${f}, value: ${value}, type: ${_type})`)
        }
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

  public static getQueryUpdate(dtos: DeepPartial<EntityHelper>[], fields: string[], fieldTypes: string[], referenceField: string, updatedAtField?: string) {
    const _fields = structuredClone(fields).filter((i) => i != referenceField);
    const subReferenceField = '_' + referenceField;
    const subFields = [subReferenceField, ..._fields].map(i => `"${i}"`);
    const fieldValues = dtos.map((dto) => `(${EntityHelper.getQueryFieldValues(dto, [referenceField, ...fields], fieldTypes)})`).join(', ');
    const updatedAt = updatedAtField ? `, "${updatedAtField}" = NOW()` : '';
    const query = `
    UPDATE transacao_view
    SET ${_fields.map((f) => `"${f}" = sub.${f == referenceField ? subReferenceField : `"${f}"`}`).join(', ')}${updatedAt}
    FROM (
        VALUES ${fieldValues}
    ) AS sub(${subFields.join(', ')})
    WHERE id = sub.${subReferenceField};
    `;
    return query;
  }
}
