import { DeepPartial } from 'typeorm';
import { IUserUploadResponse } from '../interfaces/user-upload-response.interface';
import { User } from '../entities/user.entity';

export type UserUploadData = {
  userDTOs: DeepPartial<User>[];
  requestUserEntity: User;
} & IUserUploadResponse;
