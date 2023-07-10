import {
  Injectable,
  PipeTransform,
  HttpStatus,
  ValidationPipe,
  ValidationPipeOptions,
  ArgumentMetadata,
  HttpException,
} from '@nestjs/common';
import { InviteService } from '../invite.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class IsInvitePermitCodeRegisteredPipe implements PipeTransform<any> {
  private readonly validationPipe: ValidationPipe;
  constructor(
    private readonly inviteService: InviteService,
    private usersService: UsersService,
  ) {
    const options: ValidationPipeOptions = {
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    };

    this.validationPipe = new ValidationPipe(options);
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    await this.validationPipe.transform(value, metadata);

    const hash = value;

    const inviteFound = this.inviteService.findByHash(hash);

    if (!inviteFound) {
      // ignore validation
      return value;
    }

    const userFound = this.usersService.findOne({
      permitCode: inviteFound.permitCode,
    });

    if (!userFound) {
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
          [fieldName]: 'permitCodeAlreadyRegistered',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
