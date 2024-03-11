import { NestFactory } from '@nestjs/core';
import { BankSeedService } from './bank/bank-seed.service';
import { InfoSeedService } from './info/info-seed.service';
import { MailCountSeedService } from './mail-count/mail-count-seed.service';
import { InviteStatusSeedService } from './mail-history-status/mail-history-status-seed.service';
import { MailHistorySeedService } from './mail-history/mail-history-seed.service';
import { PagadorSeedService } from './pagador/pagador-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { SettingTypeSeedService } from './setting-type/setting-type.service';
import { SettingSeedService } from './setting/setting-seed.service';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';

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
    PagadorSeedService,
  ];

  const FORCE_PARAM = '__force';
  const EXCLUDE_PARAM = '__exclude';
  const isForce = process.argv.slice(2).includes(FORCE_PARAM);
  const isExclude = process.argv.slice(2).includes(EXCLUDE_PARAM);
  global.force = isForce;
  const nameFilters = process.argv
    .slice(2)
    .filter((i) => ![FORCE_PARAM, EXCLUDE_PARAM].includes(i));
  if (nameFilters.length > 0) {
    services = services.filter(
      (s) =>
        nameFilters.some((n) =>
          s.name.toLowerCase().includes(n.toLowerCase()),
        ) !== isExclude,
    );
  }

  const app = await NestFactory.create(SeedModule);

  // validate
  console.log(
    `Validating modules before run: ${services
      .reduce((str: string[], i) => [...str, i.name], [])
      .join(', ')}`,
  );
  for (const module of services) {
    if (!(await app.get(module).validateRun()) && !isForce) {
      console.log(`[${module.name}]: Database is not empty, aborting seed...`);
      console.log(
        `Tip: Use '${FORCE_PARAM}' parameter to ignore this message.`,
      );
      await app.close();
      return;
    }
  }

  // run
  console.log(
    `Running modules: ${services
      .reduce((str: string[], i) => [...str, i.name], [])
      .join(', ')}`,
  );
  for (const module of services) {
    await app.get(module).run();
  }

  await app.close();
};

void runSeed();
