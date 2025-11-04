// Reference: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/ssh2-sftp-client/index.d.ts#L125

export interface FileInfo {
  type: FileInfoType;
  name: string;
  size: number;
  modifyTime: number;
  accessTime: number;
  rights: {
    user: string;
    group: string;
    other: string;
  };
  owner: number;
  group: number;
}

type FileInfoType = "d" | "-" | "l";