import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionarioRole } from 'src/permissionario-role/permissionario-role.entity';
import { PermissionarioRoleEnum } from 'src/permissionario-role/permissionario-role.enum';
import { Enum } from 'src/utils/enum';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionarioRoleSeedService {
  constructor(
    @InjectRepository(PermissionarioRole)
    private permRoleRepository: Repository<PermissionarioRole>,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const enumItems = Enum.getItems(PermissionarioRoleEnum);
    const newItems = enumItems.map(item =>
      this.permRoleRepository.create({
        id: item.value,
        name: item.key,
      }));
    await this.permRoleRepository.upsert(newItems, { conflictPaths: { id: true } });
  }
}
