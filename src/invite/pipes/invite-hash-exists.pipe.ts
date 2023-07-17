import {
  ArgumentMetadata,
  HttpStatus,
  HttpException,
  ValidationPipe,
  ValidationPipeOptions,
  Injectable,
} from '@nestjs/common';
import { InviteService } from '../invite.service';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';

@Injectable()
export class InviteHashExistsPipe extends ValidationPipe {
  constructor(private readonly inviteService: InviteService) {
    const options: ValidationPipeOptions = {
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    };
    super(options);
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    const transformedValue = await super.transform(value, metadata);

    const inviteFound = this.inviteService.findByHash(transformedValue);
    if (!inviteFound) {
      this.throwError(value, metadata);
    }

    return transformedValue;
  }

  private throwError(value: any, metadata: ArgumentMetadata) {
    const fieldName = String(metadata.data);
    throw new HttpException(
      {
        error: HttpErrorMessages.UNAUTHORIZED,
        details: {
          [fieldName]: 'invalidInviteHash',
        },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
