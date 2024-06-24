import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.type';
import { GitInfo } from './git-info.class';

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const pjson = require('../../package.json');

@Injectable()
export class HomeService {
  private gitInfo: GitInfo;
  private isDev: boolean;
  constructor(private configService: ConfigService<AllConfigType>) {
    this.gitInfo = new GitInfo();
    this.isDev = this.configService.get('app.nodeEnv', { infer: true }) !== 'production';
  }

  appInfo() {
    return {
      name: this.configService.get('app.name', { infer: true }),
      version: pjson.version,
      github: {
        sha: this.gitInfo.commitSha,
        date: this.gitInfo.commitDate,
        branch: this.gitInfo.branchName,
      }
    };
  }
}
