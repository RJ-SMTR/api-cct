import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITicketRevenuesGroupedResponse } from './interfaces/ticket-revenues-grouped-response.interface';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { TicketRevenuesService } from './ticket-revenues.service';

describe('TicketRevenuesController', () => {
  let ticketRevenuesController: TicketRevenuesController;
  let ticketRevenuesService: TicketRevenuesService;
  let usersService: UsersService;

  beforeEach(async () => {
    const ticketRevenuesServiceMock = {
      provide: TicketRevenuesService,
      useValue: {
        getGroupedFromUser: jest.fn(),
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

      const dataResponse: Partial<ITicketRevenuesGroup>[] = [
        { partitionDate: '2023-10-31' },
        { partitionDate: '2023-10-30' },
      ];
      const expectedResponse: ITicketRevenuesGroupedResponse = {
        data: dataResponse as ITicketRevenuesGroup[],
        ticketRevenuesGroupSum: dataResponse[0] as ITicketRevenuesGroup,
        transactionValueLastDay: 10,
      };
      jest
        .spyOn(usersService, 'getOneFromRequest')
        .mockResolvedValueOnce(user as User);
      jest
        .spyOn(ticketRevenuesService, 'getGroupedFromUser')
        .mockResolvedValueOnce(expectedResponse);

      // Act
      const result = await ticketRevenuesController.getGrouped(
        request,
        1, // page
        2, // limit
        TimeIntervalEnum.LAST_WEEK, // timeInterval
      );

      // Assert
      expect(ticketRevenuesService.getGroupedFromUser).toBeCalledTimes(1);
      expect(result).toEqual(dataResponse);
    });
  });
});
