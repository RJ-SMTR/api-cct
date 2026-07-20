import { DeepPartial } from 'typeorm';
import { AgentAssociationOption } from '../agentes.repository';
import { User } from 'src/users/entities/user.entity';

class AgenteUserRoleDto {
  constructor(role?: DeepPartial<AgenteUserRoleDto> | null) {
    if (role !== undefined) {
      Object.assign(this, role);
    }
  }

  id: number;
  name: string;
}

class AgenteUserStatusDto {
  constructor(status?: DeepPartial<AgenteUserStatusDto> | null) {
    if (status !== undefined) {
      Object.assign(this, status);
    }
  }

  id: number;
  name: string;
}

export class AgenteUserResponseDto {
  constructor(
    user?: User,
    associacoes: AgentAssociationOption[] = [],
  ) {
    if (!user) {
      return;
    }

    this.id = user.id;
    this.fullName = user.fullName ?? null;
    this.email = user.email ?? null;
    this.permitCode = user.permitCode ?? null;
    this.cpfCnpj = user.cpfCnpj ?? null;
    this.phone = user.phone ?? null;
    this.role = user.role
      ? new AgenteUserRoleDto({
        id: user.role.id,
        name: user.role.name,
      })
      : null;
    this.status = user.status
      ? new AgenteUserStatusDto({
        id: user.status.id,
        name: user.status.name,
      })
      : null;
    this.inviteStatus = user.aux_inviteStatus
      ? new AgenteUserStatusDto({
        id: user.aux_inviteStatus.id,
        name: user.aux_inviteStatus.name,
      })
      : null;
    this.inviteAt = user.inviteAt ?? null;
    this.associacoes = associacoes;
    this.updatedAt = user.updatedAt;
  }

  id: number;
  fullName: string | null;
  email: string | null;
  permitCode: string | null;
  cpfCnpj: string | null;
  phone: string | null;
  role: AgenteUserRoleDto | null;
  status: AgenteUserStatusDto | null;
  inviteStatus: AgenteUserStatusDto | null;
  inviteAt: Date | null;
  associacoes: AgentAssociationOption[];
  updatedAt: Date;
}
