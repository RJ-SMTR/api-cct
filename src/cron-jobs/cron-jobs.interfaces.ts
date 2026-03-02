import { CronJobParameters } from 'cron';

export interface ICronJob {
  name: string;
  cronJobParameters: CronJobParameters;
}
