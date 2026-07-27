export interface IMailHistoryStatusCount {
  queued: number;
  sent: number;
  used: number;
  usedIncomplete: number;
  usedComplete: number;
  total: number;
}

export interface IMailHistoryStatusGuardadorReport {
  guardador: IMailHistoryStatusCount;
  emailsNotRegistered: number;
}
