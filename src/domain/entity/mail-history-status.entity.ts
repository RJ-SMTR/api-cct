import { Column, Entity, PrimaryColumn, DeepPartial } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EntityHelper } from 'src/utils/entity-helper';
import { InviteStatusEnum } from '../enum/mail-history-status.enum';
import { Enum } from 'src/utils/enum';

@Entity('invite_status')
export class InviteStatus extends EntityHelper {
  constructor(inviteStatus?: InviteStatusEnum | DeepPartial<InviteStatus>) {
    super();
    if (typeof inviteStatus === 'number') {
      this.id = inviteStatus;
      this.name = Enum.getKey(InviteStatusEnum, inviteStatus);
    } else {
      Object.assign(this, inviteStatus);
    }
  }
  
  /** uniqueConstraintName: `UQ_InviteStatus_id` */
  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_InviteStatus_id' })
  id: number;

  @ApiProperty({ example: 'register' })
  @Column({ unique: true, nullable: false })
  name: string;
}
