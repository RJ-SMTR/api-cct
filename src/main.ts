import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import validationOptions from './utils/validation-options';
import { AllConfigType } from './config/config.type';
import { AllExceptionsFilter } from './utils/all-exteptions-filter/filters/all-exceptions.filter';
import { differenceInMinutes } from 'date-fns';
import { CustomLogger } from './utils/custom-logger';

async function bootstrap() {
  // Rede neste servidor às vezes emite um evento 'error' fora do fluxo de uma Promise
  // (ex.: timeout de handshake do SFTP disparado por um setTimeout interno da lib
  // ssh2-sftp-client/ssh2, fora do try/catch do cron job que chamou connect()).
  // Sem isso, esse tipo de erro derruba o processo inteiro da API. Apenas loga e
  // mantém a API no ar — não deve mascarar bugs que já são tratados normalmente
  // via try/catch ou pelo AllExceptionsFilter.
  const bootstrapLogger = new CustomLogger('UnhandledError', { timestamp: true });
  process.on('uncaughtException', (error) => {
    bootstrapLogger.error(`Uncaught exception (processo mantido no ar): ${error?.message}`, error?.stack);
  });
  process.on('unhandledRejection', (reason: any) => {
    bootstrapLogger.error(`Unhandled rejection (processo mantido no ar): ${reason?.message ?? reason}`, reason?.stack);
  });

  // Save BRT time before set UTC
  const localDateStr = new Date().toString();
  global.__localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = 'UTC';
  global.__localTzOffset = differenceInMinutes(
    new Date(localDateStr.split(' GMT')[0]).getTime(),
    new Date().getTime(),
  );

  const app = await NestFactory.create(AppModule, { cors: true });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter());

  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);

  await app.listen(configService.getOrThrow('app.port', { infer: true }));
}
void bootstrap();
