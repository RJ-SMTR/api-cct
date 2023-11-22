import { IFileUser } from './file-user.interface';

export interface IUserUploadResponse {
  uploadedUsers: number;
  invalidUsers: number;
  headerMap: Record<string, string>;
  invalidRows: IFileUser[];
}
