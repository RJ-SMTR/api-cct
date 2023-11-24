import { NestFactory } from '@nestjs/core';
import { BankSeedService } from './bank/bank-seed.service';
import { InfoSeedService } from './info/info-seed.service';
import { MailCountSeedService } from './mail-count/mail-count-seed.service';
import { InviteStatusSeedService } from './mail-history-status/mail-history-status-seed.service';
import { MailHistorySeedService } from './mail-history/mail-history-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { SettingTypeSeedService } from './setting-type/setting-type.service';
import { SettingSeedService } from './setting/setting-seed.service';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { InitSeedService } from './init/init-seed.service';

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
    UserSeedService,
    MailHistorySeedService,
  ];

  const nameFilter = process.argv.slice(2)[0];
  if (nameFilter) {
    services = services.filter((module) =>
      module.name.toLowerCase().includes(nameFilter.toLowerCase()),
    );
  }

  // run
  if (await app.get(InitSeedService).isDbEmpty()) {
    for (const module of services) {
      await app.get(module).run();
    }
  } else {
    console.log('Database is not empty. Aborting seed...');
  }

  await app.close();
};

void runSeed();
