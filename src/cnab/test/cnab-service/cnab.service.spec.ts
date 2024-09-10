// import { Provider } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { SchedulerRegistry } from '@nestjs/schedule';
// import { Test, TestingModule } from '@nestjs/testing';
// import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
// import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
// import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
// import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
// import { MailHistoryService } from 'src/mail-history/mail-history.service';
// import { MailRegistrationInterface } from 'src/mail/interfaces/mail-registration.interface';
// import { MailService } from 'src/mail/mail.service';
// import { Role } from 'src/roles/entities/role.entity';
// import { RoleEnum } from 'src/roles/roles.enum';
// import { SettingEntity } from 'src/settings/entities/setting.entity';
// import { SettingsService } from 'src/settings/settings.service';
// import { User } from 'src/users/entities/user.entity';
// import { UsersService } from 'src/users/users.service';
// import { DeepPartial } from 'typeorm';
// import { CnabService } from '../../cnab.service';
// import { TransacaoViewService } from 'src/transacao-view/transacao-view.service';
// import { TestUtils } from '../../../utils/test-utils';
// import { TransacaoView } from 'src/transacao-view/transacao-view.entity';
// import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
// import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';

// describe('CnabService', () => {
//   let cronJobsService: CronJobsService;
//   let settingsService: SettingsService;
//   let mailHistoryService: MailHistoryService;
//   let mailService: MailService;
//   let usersService: UsersService;
//   let transacaoViewService: TransacaoViewService;
//   let bigqueryTransacaoService: BigqueryTransacaoService;
//   let cnabService: CnabService;
//   let testUtils: TestUtils;

//   beforeEach(async () => {
//     const configServiceMock: Provider = {
//       provide: ConfigService,
//       useValue: {
//         getOrThrow: jest.fn(),
//       },
//     };
//     const settingsServiceMock: Provider = {
//       provide: SettingsService,
//       useValue: {
//         getOneBySettingData: jest.fn(),
//         findOneBySettingData: jest.fn(),
//       },
//     };
//     const mailHistoryServiceMock: Provider = {
//       provide: MailHistoryService,
//       useValue: {
//         findSentToday: jest.fn(),
//         findUnsent: jest.fn(),
//         getRemainingQuota: jest.fn(),
//         update: jest.fn(),
//       },
//     };
//     const mailServiceMock: Provider = {
//       provide: MailService,
//       useValue: {
//         sendConcludeRegistration: jest.fn(),
//       },
//     };
//     const usersServiceMock: Provider = {
//       provide: UsersService,
//       useValue: {
//         findOne: jest.fn(),
//       },
//     };
//     const schedulerRegistryMock: Provider = {
//       provide: SchedulerRegistry,
//       useValue: {
//         addCronJob: jest.fn(),
//       },
//     };
//     const cnabServiceMock: Provider = {
//       provide: CnabService,
//       useValue: {
//         // addCronJob: jest.fn(),
//       },
//     };
//     const bigqueryTransacaoServiceMock: Provider = {
//       provide: BigqueryTransacaoService,
//       useValue: {
//         getFromWeek: jest.fn(),
//       },
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         CnabService,
//         configServiceMock,
//         settingsServiceMock,
//         mailHistoryServiceMock,
//         mailServiceMock,
//         usersServiceMock,
//         schedulerRegistryMock,
//         cnabServiceMock,
//         bigqueryTransacaoServiceMock,
//       ],
//     })
//     .overrideProvider(TransacaoViewService)
//     .useClass(TransacaoViewService)
//     .compile();

//     testUtils = new TestUtils();
//     await testUtils.initializeApp(module);

//     cnabService = module.get(CnabService);
//     cronJobsService = module.get(CronJobsService);
//     settingsService = module.get(SettingsService);
//     mailHistoryService = module.get(MailHistoryService);
//     mailService = module.get(MailService);
//     usersService = module.get(UsersService);
//     transacaoViewService = module.get(TransacaoViewService);
//     bigqueryTransacaoService = module.get(BigqueryTransacaoService);

//   });

//   afterEach(async () => {
//     await testUtils.resetDatabase();
//   });

//   afterAll(async () => {
//     await testUtils.closeApp();
//   });

//   xit('should be defined', () => {
//     expect(cronJobsService).toBeDefined();
//   });

//   describe('compareTransacaoViewPublicacao', () => {
//     it('Deve salvar e atualizar os mesmos itens após 1 dia com os dados alterados', async () => {
//       // arrange
//       jest
//         .spyOn(bigqueryTransacaoService, 'getFromWeek')
//         .mockResolvedValueOnce(
//           BigqueryTransacao.fromJson(`${__dirname}/data/bq-transacao-d0.json`),
//         );
//       jest
//         .spyOn(bigqueryTransacaoService, 'getFromWeek')
//         .mockResolvedValueOnce(
//           BigqueryTransacao.fromJson(`${__dirname}/data/bq-transacao-d1.json`),
//         );

//       // act
//       await cnabService.updateTransacaoViewBigquery();

//       // assert
//       expect(true).toEqual(true);
//     });
//   });
// });
