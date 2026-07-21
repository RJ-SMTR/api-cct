import { Entity, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user.entity";
import { EntityHelper } from "src/utils/entity-helper";

@Entity({ name: 'user_relationships' })
export class UserRelationship extends EntityHelper {
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @PrimaryColumn({ name: 'related_user_id' })
  relatedUserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'related_user_id' })
  relatedUser: User;
}