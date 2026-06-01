import { Role } from './role.entity';
import { RoleEnum } from '../roles.enum';

describe('Role', () => {
  it('should use the canonical agentes name when constructed from id 5', () => {
    const role = new Role(RoleEnum.agents);

    expect(role).toMatchObject({
      id: RoleEnum.agents,
      name: 'Agentes',
    });
  });

  it('should normalize a persisted inconsistent role name after load', () => {
    const role = new Role();
    role.id = RoleEnum.agents;
    role.name = 'Admin Finan';

    role.syncCanonicalName();

    expect(role.name).toBe('Agentes');
  });
});
