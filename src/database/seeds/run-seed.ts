import { NestFactory } from '@nestjs/core';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { BankSeedService } from './bank/bank-seed.service';
import { InfoSeedService } from './info/info-seed.service';
import { InviteStatusSeedService } from './mail-history-status/mail-history-status-seed.service';
import { SettingTypeSeedService } from './setting-type/setting-type.service';
import { SettingSeedService } from './setting/setting-seed.service';
import { MailCountSeedService } from './mail-count/mail-count-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // filter
  let services = [
    RoleSeedService,
    StatusSeedService,
    UserSeedService,
    InfoSeedService,
    BankSeedService,
    InviteStatusSeedService,
    SettingTypeSeedService,
    SettingSeedService,
    MailCountSeedService,
  ];

  const nameFilter = process.argv.slice(2)[0];
  if (nameFilter) {
    services = services.filter((module) =>
      module.name.toLowerCase().includes(nameFilter.toLowerCase()),
    );
  }

  // run
  for (const module of services) {
    await app.get(module).run();
  }

  await app.close();
};

void runSeed();
