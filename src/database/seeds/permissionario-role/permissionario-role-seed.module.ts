import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionarioRole } from 'src/permissionario-role/permissionario-role.entity';
import { PermissionarioRoleSeedService } from './permissionario-role-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionarioRole])],
  providers: [PermissionarioRoleSeedService],
  exports: [PermissionarioRoleSeedService],
})
export class PermissionarioRoleSeedModule {}
