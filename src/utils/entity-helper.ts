import { Exclude, instanceToPlain } from 'class-transformer';
import { AfterLoad, BaseEntity } from 'typeorm';

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
  setFieldValues() {
    // 
  }
}
