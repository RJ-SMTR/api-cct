import { Test, TestingModule } from '@nestjs/testing';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { TicketRevenuesService } from './ticket-revenues.service';
import { Provider } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/users/entities/user.entity';
import { TicketRevenuesGetDto } from './dto/ticket-revenues-get.dto';
import { IJaeTicketRevenue } from 'src/jae/interfaces/jae-ticket-revenue.interface';
import { Request } from 'express';

describe('TicketRevenuesController', () => {
  let ticketRevenuesController: TicketRevenuesController;
  let ticketRevenuesService: TicketRevenuesService;
  let usersService: UsersService;

  beforeEach(async () => {
    const ticketRevenuesServiceMock = {
      provide: TicketRevenuesService,
      useValue: {
        getDataFromUser: jest.fn(),
      },
    } as Provider;
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        getOneFromRequest: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [ticketRevenuesServiceMock, usersServiceMock],
      controllers: [TicketRevenuesController],
    }).compile();

    ticketRevenuesController = module.get<TicketRevenuesController>(
      TicketRevenuesController,
    );
    ticketRevenuesService = module.get<TicketRevenuesService>(
      TicketRevenuesService,
    );
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(ticketRevenuesController).toBeDefined();
  });

  describe('getFromUser', () => {
    it('should return data when successfull', async () => {
      // Arrange
      const user = {
        id: 0,
        passValidatorId: 'passValidatorId_1',
      } as Partial<User>;
      const request = {
        user: {
          id: user.id,
        },
      } as Partial<Request>;
      const args = { previousDays: 1 } as TicketRevenuesGetDto;
      const expectedResult: Partial<IJaeTicketRevenue>[] = [
        { transactionId: 1 },
        { transactionId: 2 },
      ];
      jest
        .spyOn(usersService, 'getOneFromRequest')
        .mockResolvedValueOnce(user as User);
      jest
        .spyOn(ticketRevenuesService, 'getDataFromUser')
        .mockResolvedValueOnce(expectedResult as IJaeTicketRevenue[]);

      // Act
      const result = await ticketRevenuesController.getGrouped(request, args);

      // Assert
      expect(ticketRevenuesService.getUngroupedFromUser).toBeCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });
});
