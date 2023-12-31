import { ICreateUserFile } from './create-user-file.interface';

export interface IFileUser {
  row?: number;
  user: Partial<ICreateUserFile>;
  errors: Partial<ICreateUserFile>;
}
