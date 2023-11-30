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
  // filter
  let services = [
    RoleSeedService,
    StatusSeedService,
    InfoSeedService,
    BankSeedService,
    InviteStatusSeedService,
    SettingTypeSeedService,
    SettingSeedService,
    MailCountSeedService,
    UserSeedService,
    MailHistorySeedService,
  ];

  const FORCE_PARAM = '__force';
  const force = process.argv.slice(2).includes(FORCE_PARAM);
  const nameFilters = process.argv.slice(2).filter((i) => i !== FORCE_PARAM);
  if (nameFilters.length > 0) {
    services = services.filter((s) =>
      nameFilters.some((j) => s.name.toLowerCase().includes(j.toLowerCase())),
    );
  }

  // run
  const app = await NestFactory.create(SeedModule);
  if (force || (await app.get(InitSeedService).isDbEmpty())) {
    console.log(
      `Running modules: ${services
        .reduce((str: string[], i) => [...str, i.name], [])
        .join(', ')}`,
    );
    for (const module of services) {
      await app.get(module).run();
    }
  } else {
    console.log('Database is not empty. Aborting seed...');
  }

  await app.close();
};

void runSeed();
