import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/users/entities/user.entity';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';
import { FinancialMovementExportFormat } from '../dtos/financial-movement-export-request.dto';

describe('RelatorioNovoRemessaFinancialMovementService', () => {
  let service: RelatorioNovoRemessaFinancialMovementService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatorioNovoRemessaFinancialMovementService,
        {
          provide: RelatorioNovoRemessaFinancialMovementRepository,
          useValue: {
            findFinancialMovementSummary: jest.fn(),
            findFinancialMovementPage: jest.fn(),
            streamFinancialMovementRows: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getOne: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendFinancialReportExport: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RelatorioNovoRemessaFinancialMovementService>(
      RelatorioNovoRemessaFinancialMovementService,
    );
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns the async email acknowledgment and schedules export processing', async () => {
    jest.useFakeTimers();
    const user = new User({
      id: 10,
      email: 'admin@example.com',
      fullName: 'Admin User',
      role: new Role(RoleEnum.admin),
    });

    jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
    const processSpy = jest
      .spyOn(service as any, 'processFinancialMovementExport')
      .mockResolvedValue(undefined);

    const response = await service.requestFinancialMovementExport(
      {
        format: FinancialMovementExportFormat.CSV,
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
      } as any,
      { id: 10, role: new Role(RoleEnum.admin) },
    );

    expect(response).toEqual({
      message: 'Seu relatório está sendo gerado e será enviado para o seu e-mail.',
    });

    jest.runAllTimers();
    await Promise.resolve();

    expect(processSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: FinancialMovementExportFormat.CSV }),
      user,
    );
  });

  it('rejects the export request when the authenticated user has no email', async () => {
    jest.spyOn(usersService, 'getOne').mockResolvedValue(new User({
      id: 10,
      email: null,
      role: new Role(RoleEnum.admin),
    }));

    await expect(service.requestFinancialMovementExport(
      {
        format: FinancialMovementExportFormat.CSV,
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
      } as any,
      { id: 10, role: new Role(RoleEnum.admin) },
    )).rejects.toThrow('Usuário autenticado não possui email para envio do relatório');
  });

  it('generates a direct-download export file without using email delivery', async () => {
    const summary = { count: 1, data: [] };
    const generatedFile = {
      filename: 'financial-report-2026-04-01-to-2026-04-22.csv',
      filePath: '/tmp/financial-report.csv',
      contentType: 'text/csv',
      compressed: false,
    };

    jest.spyOn(service, 'findFinancialMovementSummary').mockResolvedValue(summary as any);
    const generateExportFileSpy = jest
      .spyOn(service as any, 'generateExportFile')
      .mockResolvedValue(generatedFile);

    const response = await service.downloadFinancialMovementExport({
      format: FinancialMovementExportFormat.CSV,
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    expect(response).toEqual(generatedFile);
    expect(generateExportFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: FinancialMovementExportFormat.CSV }),
      summary,
      { allowCompression: false },
    );
  });
});
