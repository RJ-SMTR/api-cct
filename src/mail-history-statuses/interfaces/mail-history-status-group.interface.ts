export interface IMailHistoryRoleCount {
  vanzeiro: number;
  guardador: number;
}

export interface IMailHistoryStatusCount {
  queued: IMailHistoryRoleCount;
  sent: IMailHistoryRoleCount;
  used: IMailHistoryRoleCount;
  prov: IMailHistoryRoleCount;
  provDescription: string;
  usedIncomplete: IMailHistoryRoleCount;
  usedComplete: IMailHistoryRoleCount;
  total: IMailHistoryRoleCount;
  noFullName: IMailHistoryRoleCount;
  noPhone: IMailHistoryRoleCount;
  noEmail: IMailHistoryRoleCount;
}
