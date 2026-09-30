import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SftpService } from './sftp.service';
import { SftpClientService } from './sftp-client/sftp-client.service';
import { SettingsService } from 'src/settings/settings.service';

describe('SftpService.submitCnabRemessa', () => {
  let service: SftpService;
  let sftpClient: { resetConnection: jest.Mock; upload: jest.Mock };

  beforeEach(async () => {
    sftpClient = {
      resetConnection: jest.fn().mockResolvedValue(undefined),
      upload: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        SftpService,
        { provide: SftpClientService, useValue: sftpClient },
        { provide: SettingsService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('x') },
        },
      ],
    }).compile();

    service = module.get(SftpService);
  });

  it('retorna um path preenchido quando o upload da certo', async () => {
    const path = await service.submitCnabRemessa('conteudo cnab');
    expect(path).not.toBe('');
    expect(sftpClient.upload).toHaveBeenCalled();
  });

  it('retorna string vazia (nao um path fantasma) quando o upload falha', async () => {
    sftpClient.upload.mockRejectedValueOnce(new Error('isDate is not a function'));
    const path = await service.submitCnabRemessa('conteudo cnab');
    expect(path).toBe('');
  });
});
