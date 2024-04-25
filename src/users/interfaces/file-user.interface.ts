import { ICreateUserFile } from './create-user-file.interface';

export interface IFileUser {
  file?: number;
  row?: number;
  user: Partial<ICreateUserFile>;
  errors: Partial<ICreateUserFile>;
}
