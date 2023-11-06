import {
  ArgumentMetadata,
  HttpStatus,
  HttpException,
  ValidationPipe,
  ValidationPipeOptions,
  Injectable,
} from '@nestjs/common';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { MailHistoryService } from '../mail-history.service';

@Injectable()
export class InviteHashExistsPipe extends ValidationPipe {
  constructor(private readonly inviteService: MailHistoryService) {
    const options: ValidationPipeOptions = {
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    };
    super(options);
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    const transformedValue = await super.transform(value, metadata);

    const inviteFound = this.inviteService.findOne({ hash: transformedValue });
    if (!inviteFound) {
      this.throwError(value, metadata);
    }

    return transformedValue;
  }

  private throwError(value: any, metadata: ArgumentMetadata) {
    const fieldName = String(metadata.data);
    throw new HttpException(
      {
        message: HttpErrorMessages.UNAUTHORIZED,
        details: {
          [fieldName]: 'invalidInviteHash',
        },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
