import { registerAs } from '@nestjs/config';
import {
  IsInt,
  IsString,
  Max,
  Min,
  ValidateIf
} from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { SftpConfig } from './config.type';

function isSftpPartiallyFilled(envValues: EnvironmentVariablesValidator) {
  return Boolean(envValues.SFTP_HOST);
}

class EnvironmentVariablesValidator {
  @ValidateIf(isSftpPartiallyFilled)
  @IsString()
  SFTP_HOST: string;

  @ValidateIf(isSftpPartiallyFilled)
  @IsInt()
  @Min(0)
  @Max(65535)
  SFTP_PORT: number;

  @ValidateIf(isSftpPartiallyFilled)
  @IsString()
  SFTP_USERNAME: string;

  @ValidateIf(isSftpPartiallyFilled)
  @IsString()
  SFTP_PASSWORD: string;
}

export default registerAs<SftpConfig>('sftp', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    host: String(process.env.SFTP_HOST),
    port: Number(process.env.SFTP_PORT),
    username: String(process.env.SFTP_USERNAME),
    password: String(process.env.SFTP_PASSWORD),
  };
});
