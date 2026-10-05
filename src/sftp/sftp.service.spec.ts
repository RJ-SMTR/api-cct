import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SftpService } from './sftp.service';
import { SftpClientService } from './sftp-client/sftp-client.service';
import { SettingsService } from 'src/settings/settings.service';

describe('SftpService.submitCnabRemessa', () => {
  let service: SftpService;
  let sftpClient: { resetConnection: jest.Mock; upload: jest.Mock };
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn().mockReturnValue(false);
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
          useValue: { getOrThrow: jest.fn().mockReturnValue('x'), get: configGet },
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

  it('envia pra /backup/remessa e grava a copia datada fora do modo teste', async () => {
    const path = await service.submitCnabRemessa('conteudo cnab');
    expect(path.startsWith('/backup/remessa/')).toBe(true);
    expect(path.startsWith('/backup/remessa-teste/')).toBe(false);
    expect(sftpClient.upload).toHaveBeenCalledTimes(2);
  });

  it('no modo teste envia so pra /backup/remessa-teste, sem copia de backup', async () => {
    configGet.mockReturnValue(true);
    const path = await service.submitCnabRemessa('conteudo cnab');
    expect(path.startsWith('/backup/remessa-teste/')).toBe(true);
    expect(sftpClient.upload).toHaveBeenCalledTimes(1);
  });

  it('retorna string vazia (nao um path fantasma) quando o upload falha', async () => {
    sftpClient.upload.mockRejectedValueOnce(new Error('isDate is not a function'));
    const path = await service.submitCnabRemessa('conteudo cnab');
    expect(path).toBe('');
  });
});
