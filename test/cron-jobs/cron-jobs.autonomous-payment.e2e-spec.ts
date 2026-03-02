import { Test, TestingModule } from '@nestjs/testing';
import { CronJobsService, CronJobsEnum } from 'src/cron-jobs/cron-jobs.service';
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
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { AprovacaoEnum } from 'src/agendamento/enums/aprovacao.enum';
import { AprovacaoPagamentoDTO } from 'src/agendamento/domain/dto/aprovacao-pagamento.dto';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';

const makeUser = (id: number, fullName: string, permitCode: string): CreateUserDto => ({
  id,
  fullName,
  email: `user${id}@example.com`,
  permitCode,
} as CreateUserDto);

const makePagador = (): PagadorDTO => ({ id: 1 } as PagadorDTO);

const makeAgendamento = (overrides: Partial<AgendamentoPagamentoDTO> = {}): AgendamentoPagamentoDTO => ({
  status: true,
  diaSemana: 4,
  createdAt: new Date('2024-03-01T00:00:00Z'),
  beneficiarioUsuario: makeUser(1, 'Benef One', 'PERM-1'),
  tipoBeneficiario: 'Consorcio',
  horario: '10:30:00',
  pagador: makePagador(),
  diaInicioPagar: 1,
  diaFinalPagar: 5,
  diaIntervalo: 7,
  aprovacao: false,
  ...overrides,
});

describe('CronJobs - Autonomous Payment (integration)', () => {
  let cronJobsService: CronJobsService;
  let agendamentoPagamentoService: AgendamentoPagamentoService;
  let remessaService: RemessaService;
  let ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService;
  let aprovacaoPagamentoService: AprovacaoPagamentoService;
  let detalheAService: DetalheAService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-04-10T10:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronJobsService,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
        { provide: SettingsService, useValue: { getOneBySettingData: jest.fn(), findOneBySettingData: jest.fn() } },
        { provide: SchedulerRegistry, useValue: { addCronJob: jest.fn() } },
        { provide: MailService, useValue: {} },
        { provide: MailHistoryService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: CnabService, useValue: {} },
        {
          provide: OrdemPagamentoAgrupadoService,
          useValue: {
            prepararPagamentoAgrupados: jest.fn(),
            prepararPagamentoAgrupadosPendentes: jest.fn(),
            excluirHistorico: jest.fn(),
            excluirOrdensAgrupadas: jest.fn(),
            getPagador: jest.fn(),
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
        { provide: OrdemPagamentoService, useValue: { findOrdensAgrupadas: jest.fn().mockResolvedValue([]), removerAgrupamentos: jest.fn() } },
        { provide: BigqueryTransacaoService, useValue: {} },
        { provide: DistributedLockService, useValue: { acquireLock: jest.fn(), releaseLock: jest.fn() } },
        { provide: AgendamentoPagamentoService, useValue: { findAll: jest.fn() } },
        { provide: AprovacaoPagamentoService, useValue: { findById: jest.fn(), save: jest.fn() } },
        { provide: DetalheAService, useValue: { getDetalheAHeaderLote: jest.fn(), existsDetalheABeneficiario: jest.fn(), saveEntity: jest.fn() } },
      ],
    }).compile();

    cronJobsService = module.get<CronJobsService>(CronJobsService);
    agendamentoPagamentoService = module.get<AgendamentoPagamentoService>(AgendamentoPagamentoService);
    remessaService = module.get<RemessaService>(RemessaService);
    ordemPagamentoAgrupadoService = module.get<OrdemPagamentoAgrupadoService>(OrdemPagamentoAgrupadoService);
    aprovacaoPagamentoService = module.get<AprovacaoPagamentoService>(AprovacaoPagamentoService);
    detalheAService = module.get<DetalheAService>(DetalheAService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates and runs an autonomous job without approval requirement', async () => {
    const agendamentos = [makeAgendamento({ aprovacao: false })];
    jest.spyOn(agendamentoPagamentoService, 'findAll').mockResolvedValue(agendamentos);

    jest.spyOn(remessaService, 'prepararRemessa').mockResolvedValue({ headersLote: [] } as any);
    jest.spyOn(remessaService, 'gerarCnabText').mockResolvedValue('TXT' as any);
    jest.spyOn(remessaService, 'enviarRemessa').mockResolvedValue(undefined as any);

    const jobs = await cronJobsService.geraCronJob();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe(`${CronJobsEnum.automacao}_Consorcio_10:30:00`);

    const onTick = jobs[0].cronJobParameters.onTick;
    if (typeof onTick !== 'function') {
      throw new Error('Expected cron job onTick to be a function');
    }

    await onTick();

    expect(ordemPagamentoAgrupadoService.prepararPagamentoAgrupados).toHaveBeenCalled();
    expect(remessaService.prepararRemessa).toHaveBeenCalled();
    expect(remessaService.gerarCnabText).toHaveBeenCalledWith(HeaderName.CONSORCIO);
    expect(remessaService.enviarRemessa).toHaveBeenCalledWith('TXT', HeaderName.CONSORCIO);
    expect(aprovacaoPagamentoService.findById).not.toHaveBeenCalled();
  });

  it('requires approval: first run does not send, after approval sends remessa', async () => {
    const aprovacao: AprovacaoPagamentoDTO = {
      id: 1,
      status: AprovacaoEnum.AguardandoAprovacao,
      valorGerado: 0,
      valorAprovado: 200,
      dataAprovacao: new Date(),
      aprovador: null as any,
      detalheA: { id: 0 } as any,
    };

    const agendamentos = [
      makeAgendamento({
        aprovacao: true,
        aprovacaoPagamento: { id: 1 } as any,
      }),
    ];
    jest.spyOn(agendamentoPagamentoService, 'findAll').mockResolvedValue(agendamentos);
    jest.spyOn(aprovacaoPagamentoService, 'findById').mockImplementation(async () => aprovacao);
    jest.spyOn(aprovacaoPagamentoService, 'save').mockResolvedValue(undefined as any);

    const detalheA = { id: 10, valorLancamento: 123, valorRealEfetivado: 0 } as DetalheA;
    jest.spyOn(detalheAService, 'getDetalheAHeaderLote').mockResolvedValue([detalheA]);
    jest.spyOn(detalheAService, 'existsDetalheABeneficiario').mockResolvedValue([detalheA as any]);
    jest.spyOn(detalheAService, 'saveEntity').mockResolvedValue(detalheA);

    jest.spyOn(remessaService, 'prepararRemessa').mockResolvedValue({ headersLote: [{ id: 1 }] } as any);
    jest.spyOn(remessaService, 'gerarCnabText').mockResolvedValue('TXT' as any);
    jest.spyOn(remessaService, 'enviarRemessa').mockResolvedValue(undefined as any);

    const jobs = await cronJobsService.geraCronJob();
    const onTick = jobs[0].cronJobParameters.onTick;
    if (typeof onTick !== 'function') {
      throw new Error('Expected cron job onTick to be a function');
    }

    // First run: not approved yet, should not send remessa
    await onTick();
    expect(remessaService.gerarCnabText).not.toHaveBeenCalled();
    expect(remessaService.enviarRemessa).not.toHaveBeenCalled();
    expect(aprovacaoPagamentoService.save).toHaveBeenCalled();

    // Approve and rerun
    aprovacao.status = AprovacaoEnum.Aprovado;
    await onTick();

    expect(detalheAService.saveEntity).toHaveBeenCalled();
    expect(remessaService.gerarCnabText).toHaveBeenCalledWith(HeaderName.CONSORCIO);
    expect(remessaService.enviarRemessa).toHaveBeenCalledWith('TXT', HeaderName.CONSORCIO);
  });
});
