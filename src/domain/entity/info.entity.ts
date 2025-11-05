import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

@Entity({ name: 'info' })
export class Info extends BaseEntity {
  @Exclude()
  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_Info_id' })
  id: number;

  /** uniqueConstraintName: `UQ_Info_name` */
  @ApiProperty({ example: 'version' })
  @Column({ unique: true })
  name: string;

  @ApiProperty({ example: '1' })
  @Column()
  value: string;

  @ApiProperty({ example: '1' })
  @Column({ nullable: true })
  version: string;
}
