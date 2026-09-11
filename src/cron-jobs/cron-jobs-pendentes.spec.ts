import * as fs from 'fs';
import { CronJobsService } from './cron-jobs.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';

describe('Pending payment job lifecycle', () => {
  const previousCronjobs = process.env.CRONJOBS;
  const unusedDependency = {} as any;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    if (previousCronjobs === undefined) delete process.env.CRONJOBS;
    else process.env.CRONJOBS = previousCronjobs;
  });

  it('initializes without reading a return or replacing the SFTP transport', async () => {
    process.env.CRONJOBS = 'false';
    jest.spyOn(CustomLogger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'log').mockImplementation(() => undefined);
    const readFile = jest.spyOn(fs, 'readFileSync').mockReturnValue('');
    const readReturn = jest.fn().mockResolvedValue(null);
    const transport = { getFirstRetornoPagamento: jest.fn(), moveToBackup: jest.fn() };
    const originalTransport = { ...transport };
    const settings = { getOneBySettingData: jest.fn().mockResolvedValue({ getValueAsString: () => '* * * * *' }) };
    const service = new CronJobsService(
      unusedDependency, settings as any, unusedDependency, unusedDependency, unusedDependency, unusedDependency,
      unusedDependency, unusedDependency, unusedDependency, unusedDependency,
      { lerRetornoSftp: readReturn } as any, transport as any,
      unusedDependency, unusedDependency, unusedDependency, unusedDependency,
    );

    await service.onModuleLoad();

    expect(service.jobsConfig.length).toBeGreaterThan(0);
    expect(readFile).not.toHaveBeenCalled();
    expect(readReturn).not.toHaveBeenCalled();
    expect(transport).toEqual(originalTransport);
  });

  it.each(['consortium', 'guardador'] as const)('sends %s pending remittances after preparation with the correct payer and cycle cutoff', async (kind) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-11T12:00:00Z'));
    for (const method of ['debug', 'log', 'warn'] as const) {
      jest.spyOn(CustomLogger.prototype, method).mockImplementation(() => undefined);
    }
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    const writeFile = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const steps: string[] = [];
    const group = jest.fn(async () => { steps.push('group'); });
    const files = [{ content: 'synthetic CNAB', headerArquivo: { id: 1 } }];
    const remittance = {
      prepararRemessa: jest.fn(async () => { steps.push('prepare'); }),
      gerarCnabText: jest.fn(async () => { steps.push('generate'); return files; }),
      enviarRemessa: jest.fn(async () => { steps.push('send'); }),
    };
    const service = new CronJobsService(
      unusedDependency, unusedDependency, unusedDependency, unusedDependency, unusedDependency, unusedDependency,
      unusedDependency, unusedDependency,
      { prepararPagamentoAgrupadosPendentes: group, prepararPagamentoAgrupadosGuardadorPendentes: group } as any,
      remittance as any, unusedDependency, unusedDependency, unusedDependency, unusedDependency, unusedDependency, unusedDependency,
    );

    if (kind === 'guardador') {
      await service.pagamentoPendentesGuardadoresExec('2026-07-01', '2026-09-11', '2026-09-11');
    } else {
      await service.remessaPendenteExec('2026-07-01', '2026-09-11', '2026-09-11');
    }

    expect(steps).toEqual(['group', 'prepare', 'generate', 'send']);
    const header = kind === 'guardador' ? HeaderName.GUARDADOR : HeaderName.MODAL;
    expect(remittance.enviarRemessa).toHaveBeenCalledWith(files, header);
    expect(remittance.gerarCnabText).toHaveBeenCalledWith(header, undefined, true);
    const args = (group.mock.calls as unknown as unknown[][])[0];
    expect(args.slice(0, 4)).toEqual([
      new Date('2026-07-01'), new Date('2026-09-07'), new Date('2026-09-11'),
      kind === 'guardador' ? 'contaRotativo' : 'contaBilhetagem',
    ]);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
