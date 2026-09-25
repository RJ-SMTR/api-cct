import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    global.__localTzOffset = 0;
  });

  it('returns both message and errors to the client when both are present', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status } as unknown as Response;
    const request = {
      method: 'PATCH',
      url: '/api/v1/users/10',
    } as Request;
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    filter.catch(
      new HttpException(
        {
          error: 'UnprocessableEntity',
          message: 'emailAlreadyExists',
          errors: {
            email: 'emailAlreadyExists',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'emailAlreadyExists',
        errors: {
          email: 'emailAlreadyExists',
        },
      }),
    );
  });
});
