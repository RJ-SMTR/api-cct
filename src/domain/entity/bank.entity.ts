import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

@Entity()
export class Bank {
  @ApiProperty()
  @PrimaryGeneratedColumn({primaryKeyConstraintName: 'PK_Bank_id'})
  @Exclude()
  id: number;

  /** uniqueConstraintName: `UQ_Bank_ispb` */
  @ApiProperty({ example: 0 })
  @Column({ unique: true })
  ispb: number;
  
  @ApiProperty({ example: 'BCO DO BRASIL S.A' })
  @Column()
  name: string;
  
  /** uniqueConstraintName: `UQ_Bank_code` */
  @ApiProperty({ example: 1 })
  @Column({ unique: true })
  code: number;

  @ApiProperty({ example: 'Banco do Brasil S.A.' })
  @Column()
  fullName: string;

  @ApiProperty({ example: true })
  @Column()
  isAllowed: boolean;
}
