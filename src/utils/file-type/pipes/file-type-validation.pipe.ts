import {
  Injectable,
  PipeTransform,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { fileConverter } from '../file-type-converter';
import { FileType } from '../types/file.type';

// .xlsx is a ZIP container (PK\x03\x04); legacy .xls is an OLE compound file. Checking the
// real signature catches a file disguised with a spreadsheet mimetype that the client sets,
// which this pipe otherwise trusts (see file-type-validation.pipe.spec.ts).
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function looksLikeSpreadsheet(buffer: Buffer): boolean {
  return (
    (buffer.length >= ZIP_SIGNATURE.length && buffer.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE)) ||
    (buffer.length >= OLE_SIGNATURE.length && buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE))
  );
}

// CSV has no binary signature: reject only what is clearly not text (NUL bytes or control
// characters outside common whitespace), rather than trying to fully validate CSV structure.
function looksLikeCsv(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  for (const byte of sample) {
    if (byte === 0x00 || (byte < 0x09 && byte !== 0x0a && byte !== 0x0d)) {
      return false;
    }
  }
  return true;
}

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

    const matchedFileType = fileConverter.mimeTypeToFileType(fileMimeType);
    const contentMatchesDeclaredType = matchedFileType === 'csv' ? looksLikeCsv(file.buffer) : looksLikeSpreadsheet(file.buffer);

    if (!contentMatchesDeclaredType) {
      throw new BadRequestException(
        `File content does not match the declared type (${fileMimeType}).`,
      );
    }

    return file;
  }
}
