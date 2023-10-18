import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EntityHelper } from 'src/utils/entity-helper';
import { InviteStatusEnum } from '../invite-status.enum';
import { getEnumKey } from 'src/utils/enum-utils';

@Entity()
export class InviteStatus extends EntityHelper {
  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @ApiProperty({ example: 'register' })
  @Column({ unique: true, nullable: false })
  name: string;

  constructor(inviteStatus?: InviteStatusEnum) {
    super();
    if (inviteStatus) {
      this.id = inviteStatus;
      this.name = getEnumKey(InviteStatusEnum, inviteStatus);
    }
  }
}
