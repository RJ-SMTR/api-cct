import {
  ArgumentMetadata,
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { InviteService } from '../invite.service';

@Injectable()
export class InviteHashExistsPipe implements PipeTransform<any> {
  private readonly validationPipe: ValidationPipe;
  constructor(private readonly inviteService: InviteService) {
    const options: ValidationPipeOptions = {
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    };

    this.validationPipe = new ValidationPipe(options);
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    await this.validationPipe.transform(value, metadata);

    const inviteFound = this.inviteService.findByHash(value);
    if (!inviteFound) {
      this.throwError(value, metadata);
    }

    return value;
  }

  private throwError(value: any, metadata: ArgumentMetadata) {
    const fieldName = String(metadata.data);
    throw new HttpException(
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          [fieldName]: 'invalidInviteHash',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
