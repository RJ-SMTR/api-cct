import {
  Injectable,
  PipeTransform,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { fileConverter } from '../file-type-converter';
import { FileType } from '../types/file.type';

@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  constructor(private readonly allowedFileTypes: FileType[]) {}

  transform(@UploadedFile() file: Express.Multer.File) {
    const fileMimeType = file.mimetype;

    const allowedMimeTypes = this.allowedFileTypes.flatMap((fileType) =>
      fileConverter.fileTypeToMimeType(fileType),
    );

    if (!allowedMimeTypes.includes(fileMimeType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types are: ${this.allowedFileTypes.join(
          ', ',
        )}`,
      );
    }

    return file;
  }
}
