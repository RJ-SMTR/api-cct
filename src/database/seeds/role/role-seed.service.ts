import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Repository } from 'typeorm';

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const master = await this.roleRepository.count({
      where: {
        id: RoleEnum.master,
      },
    });

    if (!master) {
      await this.roleRepository.save(
        this.roleRepository.create({
          id: RoleEnum.master,
          name: 'Admin Master',
        }),
      );
    }

    const countUser = await this.roleRepository.count({
      where: {
        id: RoleEnum.user,
      },
    });

    if (!countUser) {
      await this.roleRepository.save(
        this.roleRepository.create({
          id: RoleEnum.user,
          name: 'User',
        }),
      );
    }

    const countAdmin = await this.roleRepository.count({
      where: {
        id: RoleEnum.admin,
      },
    });

    if (!countAdmin) {
      await this.roleRepository.save(
        this.roleRepository.create({
          id: RoleEnum.admin,
          name: 'Admin',
        }),
      );
    }

    const countLancador = await this.roleRepository.count({
      where: {
        id: RoleEnum.lancador_financeiro,
      },
    });

    if (!countLancador) {
      await this.roleRepository.save(
        this.roleRepository.create({
          id: RoleEnum.lancador_financeiro,
          name: 'Lançador financeiro',
        }),
      );
    }

    const countAprovador = await this.roleRepository.count({
      where: {
        id: RoleEnum.aprovador_financeiro,
      },
    });

    if (!countAprovador) {
      await this.roleRepository.save(
        this.roleRepository.create({
          id: RoleEnum.aprovador_financeiro,
          name: 'Aprovador financeiro',
        }),
      );
    }
  }
}
