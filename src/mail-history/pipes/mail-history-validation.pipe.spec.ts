import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { User } from 'src/users/entities/user.entity';
import { MailHistoryValidationPipe } from './mail-history-validation.pipe';

describe('MailHistoryValidationPipe', () => {
  function buildPipe(mailHistory: MailHistory | null) {
    const mailHistoryServiceMock = {
      findOne: jest.fn().mockResolvedValue(mailHistory),
    } as unknown as MailHistoryService;

    return new MailHistoryValidationPipe(mailHistoryServiceMock);
  }

  it('includes role metadata when the already-used invite is rejected', async () => {
    expect.assertions(1);

    const user = new User({
      id: 1,
      status: new Status(StatusEnum.active),
    });
    user.role = new Role(RoleEnum.agentes);
    const mailHistory = new MailHistory({
      user,
      inviteStatus: new InviteStatus(InviteStatusEnum.used),
    });

    const pipe = buildPipe(mailHistory);

    try {
      await pipe.transform('hash_1', { data: 'hash', type: 'param' } as any);
    } catch (exception) {
      expect(exception.getResponse()).toMatchObject({
        error: {
          roleId: RoleEnum.agentes,
          redirectTo: '/agentes/sign-in',
        },
      });
    }
  });

  it('includes non-agente role metadata when the already-used invite is rejected', async () => {
    expect.assertions(1);

    const user = new User({
      id: 2,
      status: new Status(StatusEnum.active),
    });
    user.role = new Role(RoleEnum.user);
    const mailHistory = new MailHistory({
      user,
      inviteStatus: new InviteStatus(InviteStatusEnum.used),
    });

    const pipe = buildPipe(mailHistory);

    try {
      await pipe.transform('hash_2', { data: 'hash', type: 'param' } as any);
    } catch (exception) {
      expect(exception.getResponse()).toMatchObject({
        error: {
          roleId: RoleEnum.user,
          redirectTo: '/sign-in',
        },
      });
    }
  });
});
