import { FindOptionsWhere } from 'typeorm';

export type EntityCondition<Entity> = FindOptionsWhere<Entity>[] | FindOptionsWhere<Entity>;

