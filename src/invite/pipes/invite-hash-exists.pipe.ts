import {
  Injectable,
  PipeTransform,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { InviteHashDto } from '../dto/invite-hash.dto';

@Injectable()
export class InviteHashExistsPipe implements PipeTransform<any> {
  async transform(value: any) {
    const hashParamDto = plainToClass(InviteHashDto, { hash: value });
    const errors = await validate(hashParamDto);

    if (errors.length > 0) {
      const errorResponse = {};
      errors.forEach((item) => {
        if (item.constraints) {
          errorResponse[item.property] = Object.values(item.constraints)[0];
        }
      });
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: errorResponse,
      });
    }

    return value;
  }
}
