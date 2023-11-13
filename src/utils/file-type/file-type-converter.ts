import { fileTypeMap } from './mappings/file-type.map';

export const fileConverter = {
  map: fileTypeMap,

  mimeTypeToFileType: function (inputString: string): string | null {
    for (const fileType in this.map) {
      if (this.map[fileType].includes(inputString)) {
        return fileType;
      }
    }
    return null;
  },

  fileTypeToMimeType: function (fileType: string): string[] | null {
    return this.map[fileType] || null;
  },
};
