import { Test, TestingModule } from '@nestjs/testing';
import { CronJobsEnum, CronJobsService } from './cron-jobs.service';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from 'src/settings/settings.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MailService } from 'src/mail/mail.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { UsersService } from 'src/users/users.service';
import { CnabService } from 'src/cnab/cnab.service';
import { OrdemPagamentoAgrupadoService } from 'src/cnab/novo-remessa/service/ordem-pagamento-agrupado.service';
import { RemessaService } from 'src/cnab/novo-remessa/service/remessa.service';
import { RetornoService } from 'src/cnab/novo-remessa/service/retorno.service';
import { OrdemPagamentoService } from 'src/cnab/novo-remessa/service/ordem-pagamento.service';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { DistributedLockService } from 'src/cnab/novo-remessa/service/distributed-lock.service';
import { AgendamentoPagamentoService } from 'src/agendamento/service/agendamento-pagamento.service';
import { AprovacaoPagamentoService } from 'src/agendamento/service/aprovacao-pagamento.service';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { AgendamentoPagamentoDTO } from 'src/agendamento/domain/dto/agendamento-pagamento.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { AprovacaoEnum } from 'src/agendamento/enums/aprovacao.enum';

const makeUser = (id: number, fullName: string): CreateUserDto => ({
  id,
  fullName,
  email: `user${id}@example.com`,
} as CreateUserDto);

const makePagador = (): PagadorDTO => ({ id: 1 } as PagadorDTO);

describe('CronJobsService.geraCronJob', () => {
  let cronJobsService: CronJobsService;
  let agendamentoPagamentoService: AgendamentoPagamentoService;
  let ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService;
  let remessaService: RemessaService;
  let aprovacaoPagamentoService: AprovacaoPagamentoService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-04-10T10:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronJobsService,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
        { provide: SettingsService, useValue: { getOneBySettingData: jest.fn(), findOneBySettingData: jest.fn() } },
        { provide: SchedulerRegistry, useValue: { addCronJob: jest.fn() } },
        { provide: MailService, useValue: { sendConcludeRegistration: jest.fn() } },
        { provide: MailHistoryService, useValue: { findSentToday: jest.fn(), findUnsent: jest.fn(), getRemainingQuota: jest.fn(), update: jest.fn() } },
        { provide: UsersService, useValue: { findOne: jest.fn() } },
        { provide: CnabService, useValue: {} },
        {
          provide: OrdemPagamentoAgrupadoService,
          useValue: {
            excluirHistorico: jest.fn(),
            excluirOrdensAgrupadas: jest.fn(),
            prepararPagamentoAgrupados: jest.fn(),
          },
        },
        {
          provide: RemessaService,
          useValue: {
            prepararRemessa: jest.fn(),
            gerarCnabText: jest.fn(),
            enviarRemessa: jest.fn(),
          },
        },
        { provide: RetornoService, useValue: {} },
        { provide: OrdemPagamentoService, useValue: { findOrdensAgrupadas: jest.fn(), removerAgrupamentos: jest.fn() } },
        { provide: BigqueryTransacaoService, useValue: { getAllTransacoes: jest.fn() } },
        { provide: DistributedLockService, useValue: { acquireLock: jest.fn(), releaseLock: jest.fn() } },
        { provide: AgendamentoPagamentoService, useValue: { findAll: jest.fn() } },
        { provide: AprovacaoPagamentoService, useValue: { findById: jest.fn(), save: jest.fn() } },
        { provide: DetalheAService, useValue: { getDetalheAHeaderLote: jest.fn(), existsDetalheABeneficiario: jest.fn(), saveEntity: jest.fn() } },
      ],
    }).compile();

    cronJobsService = module.get<CronJobsService>(CronJobsService);
    agendamentoPagamentoService = module.get<AgendamentoPagamentoService>(AgendamentoPagamentoService);
    ordemPagamentoAgrupadoService = module.get<OrdemPagamentoAgrupadoService>(OrdemPagamentoAgrupadoService);
    remessaService = module.get<RemessaService>(RemessaService);
    aprovacaoPagamentoService = module.get<AprovacaoPagamentoService>(AprovacaoPagamentoService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns empty when no agendamentos exist', async () => {
    jest.spyOn(agendamentoPagamentoService, 'findAll').mockResolvedValue([]);

    const jobs = await cronJobsService.geraCronJob();

    expect(jobs).toEqual([]);
  });

  it('groups agendamentos by tipoBeneficiario and aggregates beneficiaries', async () => {
    const ben1 = makeUser(1, 'User One');
    const ben2 = makeUser(2, 'User Two');
    const ben3 = makeUser(3, 'User Three');

    const agendamentos: AgendamentoPagamentoDTO[] = [
      {
        status: true,
        diaSemana: 4,
        createdAt: new Date('2024-03-01T00:00:00Z'),
        beneficiarioUsuario: ben1,
        tipoBeneficiario: 'Consorcio',
        horario: '10:30:00',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: true,
      },
      {
        status: true,
        diaSemana: 4,
        createdAt: new Date('2024-03-02T00:00:00Z'),
        beneficiarioUsuario: ben2,
        tipoBeneficiario: 'Consorcio',
        horario: '10:30:00',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: true,
      },
      {
        status: true,
        diaSemana: 4,
        createdAt: new Date('2024-03-03T00:00:00Z'),
        beneficiarioUsuario: ben3,
        tipoBeneficiario: 'Modal',
        horario: '14:05',
        pagador: makePagador(),
        diaInicioPagar: 2,
        diaFinalPagar: 6,
        diaIntervalo: 7,
        aprovacao: false,
      },
      {
        status: true,
        diaSemana: 3,
        createdAt: new Date('2024-05-01T00:00:00Z'),
        beneficiarioUsuario: makeUser(4, 'Ignored'),
        tipoBeneficiario: 'Ignored',
        horario: '09:00:00',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: false,
      },
      {
        status: true,
        diaSemana: 4,
        createdAt: new Date('2024-03-04T00:00:00Z'),
        beneficiarioUsuario: undefined,
        tipoBeneficiario: 'Consorcio',
        horario: '10:30:00',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: true,
      },
    ];

    jest.spyOn(agendamentoPagamentoService, 'findAll').mockResolvedValue(agendamentos);
    const remessaSpy = jest.spyOn(cronJobsService, 'remessaAutomacaoExec').mockResolvedValue(undefined);

    const jobs = await cronJobsService.geraCronJob();

    expect(jobs).toHaveLength(2);

    const consorcioJob = jobs.find(j => j.name === `${CronJobsEnum.automacao}_Consorcio_10:30:00`);
    const modalJob = jobs.find(j => j.name === `${CronJobsEnum.automacao}_Modal_14:05`);

    expect(consorcioJob?.cronJobParameters.cronTime).toBe('30 10 * * *');
    expect(modalJob?.cronJobParameters.cronTime).toBe('5 14 * * *');

    const onTick = consorcioJob?.cronJobParameters.onTick;
    expect(typeof onTick).toBe('function');
    if (typeof onTick !== 'function') {
      throw new Error('Expected consorcio cron job onTick to be a function');
    }
    await onTick();

    expect(remessaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoBeneficiario: 'Consorcio',
        horario: '10:30:00',
        beneficiarios: expect.arrayContaining([ben1, ben2]),
      }),
    );
  });

  it('ignores inactive agendamentos', async () => {
    const agendamentos: AgendamentoPagamentoDTO[] = [
      {
        status: false,
        diaSemana: 4,
        createdAt: new Date('2024-03-01T00:00:00Z'),
        beneficiarioUsuario: makeUser(1, 'Inactive One'),
        tipoBeneficiario: 'Consorcio',
        horario: '10:30:00',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: true,
      },
      {
        status: false,
        diaSemana: 4,
        createdAt: new Date('2024-03-02T00:00:00Z'),
        beneficiarioUsuario: makeUser(2, 'Inactive Two'),
        tipoBeneficiario: 'Modal',
        horario: '14:05',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: false,
      },
    ];

    jest.spyOn(agendamentoPagamentoService, 'findAll').mockResolvedValue(agendamentos);

    const jobs = await cronJobsService.geraCronJob();

    expect(jobs).toEqual([]);
  });

  it('triggers remessaAutomacaoExec without executing deep remessa steps', async () => {
    const rem = {
      beneficiarios: [makeUser(10, 'User Ten'), makeUser(11, 'User Eleven')],
      diaInicioPagar: 1,
      diaFinalPagar: 5,
      diaIntervalo: 7,
      tipoBeneficiario: 'Consorcio',
      horario: '10:30:00',
      pagador: makePagador(),
      aprovacao: true,
    } as any;

    const limparSpy = jest.spyOn(cronJobsService, 'limparAgrupamentos').mockResolvedValue(undefined);
    const geradorSpy = jest.spyOn(cronJobsService as any, 'geradorRemessaExec').mockResolvedValue(undefined);

    await cronJobsService.remessaAutomacaoExec(rem);

    expect(limparSpy).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), ['User Ten', 'User Eleven']);
    expect(geradorSpy).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), expect.any(Date), ['User Ten', 'User Eleven'], rem);

    const [limparInicio, limparFim] = limparSpy.mock.calls[0];
    const [geradorInicio, geradorFim] = geradorSpy.mock.calls[0];
    expect(geradorInicio).toEqual(limparInicio);
    expect(geradorFim).toEqual(limparFim);

    expect(ordemPagamentoAgrupadoService.prepararPagamentoAgrupados).not.toHaveBeenCalled();
    expect(remessaService.prepararRemessa).not.toHaveBeenCalled();
    expect(remessaService.gerarCnabText).not.toHaveBeenCalled();
    expect(remessaService.enviarRemessa).not.toHaveBeenCalled();
  });

  it('does not generate or send remessa when approval is required but not approved', async () => {
    const rem = {
      tipoBeneficiario: 'Modal',
      pagador: makePagador(),
      aprovacao: true,
      beneficiarios: [makeUser(21, 'Needs Approval')],
    } as any;

    const dataInicio = new Date('2024-04-08T00:00:00Z');
    const dataFim = new Date('2024-04-10T00:00:00Z');
    const dataPagamento = new Date('2024-04-11T00:00:00Z');

    (remessaService.prepararRemessa as jest.Mock).mockResolvedValue({ headersLote: [] });
    jest.spyOn(cronJobsService, 'verificarAprovacao').mockResolvedValue(false);

    await (cronJobsService as any).geradorRemessaExec(dataInicio, dataFim, dataPagamento, ['STPC'], rem);

    expect(ordemPagamentoAgrupadoService.prepararPagamentoAgrupados).toHaveBeenCalledWith(
      dataInicio,
      dataFim,
      dataPagamento,
      rem.pagador,
      ['STPC'],
    );
    expect(remessaService.prepararRemessa).toHaveBeenCalledWith(dataInicio, dataFim, dataPagamento, ['STPC']);
    expect(cronJobsService.verificarAprovacao).toHaveBeenCalled();
    expect(remessaService.gerarCnabText).not.toHaveBeenCalled();
    expect(remessaService.enviarRemessa).not.toHaveBeenCalled();
  });

  it('runs job once pending approval and sends only after approval on next run', async () => {
    const agendamentos: AgendamentoPagamentoDTO[] = [
      {
        status: true,
        diaSemana: 4,
        createdAt: new Date('2024-04-01T00:00:00Z'),
        beneficiarioUsuario: makeUser(22, 'Approved Payment'),
        tipoBeneficiario: 'Modal',
        horario: '14:05',
        pagador: makePagador(),
        diaInicioPagar: 1,
        diaFinalPagar: 5,
        diaIntervalo: 7,
        aprovacao: true,
        aprovacaoPagamento: { id: 99 } as any,
      },
    ];

    const fakeCnab = [{ content: 'fake-cnab' }];
    jest.spyOn(agendamentoPagamentoService, 'findAll').mockResolvedValue(agendamentos);
    jest.spyOn(cronJobsService, 'limparAgrupamentos').mockResolvedValue(undefined);
    (remessaService.prepararRemessa as jest.Mock).mockResolvedValue({ headersLote: [] });
    (remessaService.gerarCnabText as jest.Mock).mockResolvedValue(fakeCnab);
    (aprovacaoPagamentoService.findById as jest.Mock)
      .mockResolvedValueOnce({ status: AprovacaoEnum.AguardandoAprovacao })
      .mockResolvedValueOnce({ status: AprovacaoEnum.Aprovado, valorAprovado: 100 });

    const jobs = await cronJobsService.geraCronJob();
    const modalJob = jobs.find(j => j.name === `${CronJobsEnum.automacao}_Modal_14:05`);
    const onTick = modalJob?.cronJobParameters.onTick;

    expect(typeof onTick).toBe('function');
    if (typeof onTick !== 'function') {
      throw new Error('Expected modal cron job onTick to be a function');
    }

    await onTick();
    expect(remessaService.gerarCnabText).not.toHaveBeenCalled();
    expect(remessaService.enviarRemessa).not.toHaveBeenCalled();
    expect(aprovacaoPagamentoService.findById).toHaveBeenCalledWith(99);

    await onTick();
    expect(aprovacaoPagamentoService.findById).toHaveBeenCalledTimes(2);
    expect(remessaService.gerarCnabText).toHaveBeenCalledTimes(1);
    expect(remessaService.enviarRemessa).toHaveBeenCalledTimes(1);
    expect(remessaService.enviarRemessa).toHaveBeenCalledWith(fakeCnab, expect.anything());
  });
});
