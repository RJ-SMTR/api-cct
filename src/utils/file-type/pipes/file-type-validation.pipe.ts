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

  transform(
    @UploadedFile() fileOrFiles: Express.Multer.File | Express.Multer.File[],
  ) {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    for (const i in files) {
      const file = files[i];
      const fileMimeType = file.mimetype;

      const allowedMimeTypes = this.allowedFileTypes.flatMap((fileType) =>
        fileConverter.fileTypeToMimeType(fileType),
      );

      if (!allowedMimeTypes.includes(fileMimeType)) {
        throw new BadRequestException(
          `Invalid file ${i} type. Allowed types are: ${this.allowedFileTypes.join(
            ', ',
          )}`,
        );
      }
    }

    return fileOrFiles;
  }
}
