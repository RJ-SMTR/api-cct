import {
  Injectable,
  PipeTransform,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';

type AllowedFileTypes = 'spreadsheet' | 'text';

const fileTypeMappings: Record<AllowedFileTypes, string[]> = {
  spreadsheet: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  text: ['text/csv'],
};

@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  constructor(private readonly allowedFileTypes: AllowedFileTypes[]) {}

  transform(@UploadedFile() file: Express.Multer.File) {
    const fileMimeType = file.mimetype;

    const allowedMimeTypes = this.allowedFileTypes.flatMap(
      (fileType) => fileTypeMappings[fileType],
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
