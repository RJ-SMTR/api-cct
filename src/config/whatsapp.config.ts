import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';
import validateConfig from 'src/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  WHATSAPP_PHONE_ID: string;

  @IsString()
  @IsOptional()
  WHATSAPP_TOKEN_SECRET: string;
}

export default registerAs('whatsapp', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    senderPhoneId: process.env.WHATSAPP_PHONE_ID,
    accessTokenSecret: process.env.WHATSAPP_TOKEN_SECRET,
  };
});
