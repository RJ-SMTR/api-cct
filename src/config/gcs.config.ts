import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { GcsConfig } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  GCS_BUCKET_NAME: string;
}

export default registerAs<GcsConfig>('gcs', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    bucketName: process.env.GCS_BUCKET_NAME,
  };
});
