import { NestFactory } from '@nestjs/core';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { InfoSeedService } from './info/info-seed.service';
import { ValidationCodeMethodSeedService } from './validation-code-method/validation-code-method-seed.service';
import { ValidationCodeDestinationSeedService } from './validdation-code-destination/validation-code-destination-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // run
  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();
  await app.get(InfoSeedService).run();
  await app.get(ValidationCodeDestinationSeedService).run();
  await app.get(ValidationCodeMethodSeedService).run();

  await app.close();
};

void runSeed();
