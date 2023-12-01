import { Column, Entity, PrimaryColumn, DeepPartial } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EntityHelper } from 'src/utils/entity-helper';
import { InviteStatusEnum } from '../mail-history-status.enum';
import { Enum } from 'src/utils/enum';

@Entity()
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

  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @ApiProperty({ example: 'register' })
  @Column({ unique: true, nullable: false })
  name: string;
}
