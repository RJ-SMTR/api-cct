import {
  ArgumentMetadata,
  HttpException,
  HttpStatus,
  Injectable,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { HttpStatusMessage } from 'src/utils/enums/http-status-message.enum';
import { MailHistoryService } from '../mail-history.service';

@Injectable()
export class MailHistoryValidationPipe extends ValidationPipe {
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
    const inviteFound = await this.inviteService.findOne({
      hash: transformedValue,
    });

    const fieldName = String(metadata.data);
    if (!inviteFound) {
      throw new HttpException(
        {
          message: HttpStatusMessage.UNAUTHORIZED,
          details: {
            [fieldName]: 'invalid invite hash',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    } else if (inviteFound.getMailStatus() === InviteStatusEnum.used) {
      throw new HttpException(
        {
          message: HttpStatusMessage.UNAUTHORIZED,
          details: {
            inviteStatus: "is already 'sent'. Cant be reused.",
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return transformedValue;
  }
}
