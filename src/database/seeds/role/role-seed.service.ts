import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Repository } from 'typeorm';

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(Role)
    private repository: Repository<Role>,
  ) {}

  async run() {

    const master = await this.repository.count({
      where: {
        id: RoleEnum.master,
      },
    });

    if (!master) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.master,
          name: 'Admin Master',
        }),
      );
    }

    const countUser = await this.repository.count({
      where: {
        id: RoleEnum.user,
      },
    });

    if (!countUser) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.user,
          name: 'User',
        }),
      );
    }

    const countAdmin = await this.repository.count({
      where: {
        id: RoleEnum.admin,
      },
    });

    if (!countAdmin) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.admin,
          name: 'Admin',
        }),
      );
    }

    const countLancador = await this.repository.count({
      where: {
        id: RoleEnum.lancador_financeiro,
      },
    });

    if (!countLancador) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.lancador_financeiro,
          name: 'Lançador financeiro',
        }),
      );
    }

    const countAprovador = await this.repository.count({
      where: {
        id: RoleEnum.aprovador_financeiro,
      },
    });

    if (!countAprovador) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.aprovador_financeiro,
          name: 'Aprovador financeiro',
        }),
      );
    }

    const admin_finan = await this.repository.count({
      where: {
        id: RoleEnum.admin_finan,
      },
    });

    if (!admin_finan) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.admin_finan,
          name: 'Admin Finan',
        }),
      );
    }
  }
}
