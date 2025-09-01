import { ICreateUserFile } from './create-user-file.interface';
export type IFileUserErrors = {
  [K in keyof ICreateUserFile]?: string;
};
export type IFileUserUpdates = Partial<{ id: number, lastPermitCode: string } & ICreateUserFile>;



export interface IFileUser {
  row?: number;
  user: Partial<ICreateUserFile>;   
  errors: IFileUserErrors;       
  update: IFileUserUpdates;    
}

