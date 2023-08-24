import { Test, TestingModule } from '@nestjs/testing';
import { TicketRevenuesService } from './ticket-revenues.service';
// import { Provider } from '@nestjs/common';
// import { JaeService } from 'src/jae/jae.service';
// import { User } from 'src/users/entities/user.entity';
// import { JaeTicketRevenueInterface } from 'src/jae/interfaces/jae-ticket-revenue.interface';

describe('TicketRevenuesService', () => {
  let ticketRevenuesService: TicketRevenuesService;
  // let jaeService: JaeService;

  beforeEach(async () => {
    // const jaeServiceMock = {
    //   provide: JaeService,
    //   useValue: {
    //     getTicketRevenuesByValidator: jest.fn()
    //   }
    // } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketRevenuesService],
    }).compile();

    ticketRevenuesService = module.get<TicketRevenuesService>(
      TicketRevenuesService,
    );
    // jaeService = module.get<JaeService>(JaeService);
  });

  it('should be defined', () => {
    expect(ticketRevenuesService).toBeDefined();
  });

  // describe('getDataFromUser', async () => {
  //   // Arrange
  //   let expectedResult: JaeTicketRevenueInterface[] = [];
  //   for (let day = 1; day <= 3; day++) {
  //     for (let i = 0; i < 3; i++) {
  //       const dayStr = day.toString().padStart(2, '0');
  //       const hourStr = i.toString().padStart(2, '0');
  //       expectedResult.push({
  //         id: i,
  //         amount: i,
  //         dateTime: `2023-06-${dayStr}T06:${hourStr}0:00.000Z`,
  //         lat: i,
  //         lon: i,
  //         passValidatorId: `passValidatorId_${i}`,
  //         plate: `plate_${i}`,
  //         transactions: i,
  //       });
  //     }
  //   }
  //   const user = {
  //     id: 1,
  //     passValidatorId: expectedResult[0].passValidatorId
  //   } as Partial<User>;
  //   jest.spyOn(jaeService, 'getTicketRevenuesByValidator')
  //     .mockResolvedValueOnce(expectedResult)

  //   // Act
  //   const resultPreviousDays = ticketRevenuesService
  //     .getDataFromUser(user as unknown as User, { previousDays: 7 });
  //   const resultBetweenDates = ticketRevenuesService
  //     .getDataFromUser(user as unknown as User, {
  //       startDate: '2023-06-01',
  //       endDate: '2023-06-03',
  //     });

  //   // Assert
  // });
});
