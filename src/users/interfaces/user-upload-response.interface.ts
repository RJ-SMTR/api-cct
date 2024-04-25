import { DeepPartial } from 'typeorm';
import { IFileUser } from './file-user.interface';

export interface IUserUploadResponse {
  uploadedUsers: number;
  invalidUsers: number;
  headerMap: Record<string, string>;
  invalidRows: IFileUser[];
  uploadedRows: DeepPartial<IFileUser>[];
  changesLog?: any[];
}
