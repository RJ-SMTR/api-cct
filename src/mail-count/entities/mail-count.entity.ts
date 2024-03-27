import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class MailCount extends BaseEntity {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({primaryKeyConstraintName: 'PK_MailCount_id'})
  id: number;

  /** uniqueConstraintName: `UQ_MailCount_email` */
  @Column({ type: String, unique: true })
  email: string;

  @Column()
  recipientCount: number;

  @Column()
  maxRecipients: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
