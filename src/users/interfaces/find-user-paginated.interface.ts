export interface IFindUserPaginated {
  _anyField?: {
    value?: string;
    fields: string[];
  };
  name?: string;
  permitCode?: string;
  email?: string;
  cpfCnpj?: string;
  isSgtuBlocked?: boolean;
  passValidatorId?: string;
  inviteStatusName?: string;
}
