import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EntityHelper } from 'src/utils/entity-helper';
import { InviteStatusEnum } from '../mail-history-status.enum';
import { Enum } from 'src/utils/enum';

@Entity()
export class InviteStatus extends EntityHelper {
  constructor(inviteStatus?: InviteStatusEnum) {
    super();
    if (inviteStatus) {
      this.id = inviteStatus;
      this.name = Enum.getKey(InviteStatusEnum, inviteStatus);
    }
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @ApiProperty({ example: 'register' })
  @Column({ unique: true, nullable: false })
  name: string;
}