import { OpenMode, ReadStream, Stats, WriteFileOptions, WriteStream } from "fs";
import { EventEmitter, ReadableOptions, WritableOptions } from "stream";

export interface SFTPWrapper extends EventEmitter {
  /**
   * (Client-only)
   * Downloads a file at `remotePath` to `localPath` using parallel reads for faster throughput.
   */
  fastGet(remotePath: string, localPath: string, options: TransferOptions, callback: Callback): void;

  /**
   * (Client-only)
   * Downloads a file at `remotePath` to `localPath` using parallel reads for faster throughput.
   */
  fastGet(remotePath: string, localPath: string, callback: Callback): void;

  /**
   * (Client-only)
   * Uploads a file from `localPath` to `remotePath` using parallel reads for faster throughput.
   */
  fastPut(localPath: string, remotePath: string, options: TransferOptions, callback: Callback): void;

  /**
   * (Client-only)
   * Uploads a file from `localPath` to `remotePath` using parallel reads for faster throughput.
   */
  fastPut(localPath: string, remotePath: string, callback: Callback): void;

  /**
   * (Client-only)
   * Reads a file in memory and returns its contents
   */
  readFile(
    remotePath: string,
    options: ReadFileOptions,
    callback: (err: Error | undefined, handle: Buffer) => void,
  ): void;

  /**
   * (Client-only)
   * Reads a file in memory and returns its contents
   */
  readFile(
    remotePath: string,
    encoding: BufferEncoding,
    callback: (err: Error | undefined, handle: Buffer) => void,
  ): void;

  /**
   * (Client-only)
   * Reads a file in memory and returns its contents
   */
  readFile(remotePath: string, callback: (err: Error | undefined, handle: Buffer) => void): void;

  /**
   * (Client-only)
   * Returns a new readable stream for `path`.
   */
  createReadStream(path: string, options?: ReadStreamOptions): ReadStream;

  /**
   * (Client-only)
   * Writes data to a file
   */
  writeFile(remotePath: string, data: string | Buffer, options: WriteFileOptions, callback?: Callback): void;

  /**
   * (Client-only)
   * Writes data to a file
   */
  writeFile(remotePath: string, data: string | Buffer, encoding: string, callback?: Callback): void;

  /**
   * (Client-only)
   * Writes data to a file
   */
  writeFile(remotePath: string, data: string | Buffer, callback?: Callback): void;

  /**
   * (Client-only)
   * Appends data to a file
   */
  appendFile(remotePath: string, data: string | Buffer, options: WriteFileOptions, callback?: Callback): void;

  /**
   * (Client-only)
   * Appends data to a file
   */
  appendFile(remotePath: string, data: string | Buffer, callback?: Callback): void;

  /**
   * (Client-only)
   * Returns a new writable stream for `path`.
   */
  createWriteStream(path: string, options?: WriteStreamOptions): WriteStream;

  /**
   * (Client-only)
   * Opens a file `filename` for `mode` with optional `attributes`.
   */
  open(
    filename: string,
    mode: number | OpenMode,
    attributes: InputAttributes,
    callback: (err: Error | undefined, handle: Buffer) => void,
  ): void;
  open(
    filename: string,
    mode: number | OpenMode,
    attributes: string | number,
    callback: (err: Error | undefined, handle: Buffer) => void,
  ): void;

  /**
   * (Client-only)
   * Opens a file `filename` for `mode`.
   */
  open(filename: string, mode: number | OpenMode, callback: (err: Error | undefined, handle: Buffer) => void): void;

  /**
   * (Client-only)
   * Closes the resource associated with `handle` given by `open()` or `opendir()`.
   */
  close(handle: Buffer, callback: Callback): void;

  /**
   * (Client-only)
   * Reads `length` bytes from the resource associated with `handle` starting at `position`
   * and stores the bytes in `buffer` starting at `offset`.
   */
  read(
    handle: Buffer,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (err: Error | undefined, bytesRead: number, buffer: Buffer, position: number) => void,
  ): void;

  /**
   * (Client-only)
   */
  write(handle: Buffer, buffer: Buffer, offset: number, length: number, position: number, callback: Callback): void;

  /**
   * (Client-only)
   * Retrieves attributes for the resource associated with `handle`.
   */
  fstat(handle: Buffer, callback: (err: Error | undefined, stats: Stats) => void): void;

  /**
   * (Client-only)
   * Sets the attributes defined in `attributes` for the resource associated with `handle`.
   */
  fsetstat(handle: Buffer, attributes: InputAttributes, callback: Callback): void;

  /**
   * (Client-only)
   * Sets the access time and modified time for the resource associated with `handle`.
   */
  futimes(handle: Buffer, atime: number | Date, mtime: number | Date, callback: Callback): void;

  /**
   * (Client-only)
   * Sets the owner for the resource associated with `handle`.
   */
  fchown(handle: Buffer, uid: number, gid: number, callback: Callback): void;

  /**
   * (Client-only)
   * Sets the mode for the resource associated with `handle`.
   */
  fchmod(handle: Buffer, mode: number | string, callback: Callback): void;

  /**
   * (Client-only)
   * Opens a directory `path`.
   */
  opendir(path: string, callback: (err: Error | undefined, handle: Buffer) => void): void;

  /**
   * (Client-only)
   * Retrieves a directory listing.
   */
  readdir(location: string | Buffer, callback: (err: Error | undefined, list: FileEntryWithStats[]) => void): void;

  /**
   * (Client-only)
   * Removes the file/symlink at `path`.
   */
  unlink(path: string, callback: Callback): void;

  /**
   * (Client-only)
   * Renames/moves `srcPath` to `destPath`.
   */
  rename(srcPath: string, destPath: string, callback: Callback): void;

  /**
   * (Client-only)
   * Creates a new directory `path`.
   */
  mkdir(path: string, attributes: InputAttributes, callback: Callback): void;

  /**
   * (Client-only)
   * Creates a new directory `path`.
   */
  mkdir(path: string, callback: Callback): void;

  /**
   * (Client-only)
   * Removes the directory at `path`.
   */
  rmdir(path: string, callback: Callback): void;

  /**
   * (Client-only)
   * Retrieves attributes for `path`.
   */
  stat(path: string, callback: (err: Error | undefined, stats: Stats) => void): void;

  /**
   * (Client-only)
   * `path` exists.
   */
  exists(path: string, callback: (hasError: boolean) => void): void;

  /**
   * (Client-only)
   * Retrieves attributes for `path`. If `path` is a symlink, the link itself is stat'ed
   * instead of the resource it refers to.
   */
  lstat(path: string, callback: (err: Error | undefined, stats: Stats) => void): void;

  /**
   * (Client-only)
   * Sets the attributes defined in `attributes` for `path`.
   */
  setstat(path: string, attributes: InputAttributes, callback: Callback): void;

  /**
   * (Client-only)
   * Sets the access time and modified time for `path`.
   */
  utimes(path: string, atime: number | Date, mtime: number | Date, callback: Callback): void;

  /**
   * (Client-only)
   * Sets the owner for `path`.
   */
  chown(path: string, uid: number, gid: number, callback: Callback): void;

  /**
   * (Client-only)
   * Sets the mode for `path`.
   */
  chmod(path: string, mode: number | string, callback: Callback): void;

  /**
   * (Client-only)
   * Retrieves the target for a symlink at `path`.
   */
  readlink(path: string, callback: (err: Error | undefined, target: string) => void): void;

  /**
   * (Client-only)
   * Creates a symlink at `linkPath` to `targetPath`.
   */
  symlink(targetPath: string, linkPath: string, callback: Callback): void;

  /**
   * (Client-only)
   * Resolves `path` to an absolute path.
   */
  realpath(path: string, callback: (err: Error | undefined, absPath: string) => void): void;

  /**
   * (Client-only, OpenSSH extension)
   * Performs POSIX rename(3) from `srcPath` to `destPath`.
   */
  ext_openssh_rename(srcPath: string, destPath: string, callback: Callback): void;

  /**
   * (Client-only, OpenSSH extension)
   * Performs POSIX statvfs(2) on `path`.
   */
  ext_openssh_statvfs(path: string, callback: (err: Error | undefined, fsInfo: any) => void): void;

  /**
   * (Client-only, OpenSSH extension)
   * Performs POSIX fstatvfs(2) on open handle `handle`.
   */
  ext_openssh_fstatvfs(handle: Buffer, callback: (err: Error | undefined, fsInfo: any) => void): void;

  /**
   * (Client-only, OpenSSH extension)
   * Performs POSIX link(2) to create a hard link to `targetPath` at `linkPath`.
   */
  ext_openssh_hardlink(targetPath: string, linkPath: string, callback: Callback): void;

  /**
   * (Client-only, OpenSSH extension)
   * Performs POSIX fsync(3) on the open handle `handle`.
   */
  ext_openssh_fsync(handle: Buffer, callback: (err: Error | undefined, fsInfo: any) => void): void;

  /**
   * (Client-only, OpenSSH extension)
   * Similar to setstat(), but instead sets attributes on symlinks.
   */
  ext_openssh_lsetstat(path: string, attrs: InputAttributes, callback: Callback): void;
  ext_openssh_lsetstat(path: string, callback: Callback): void;

  /**
   * (Client-only, OpenSSH extension)
   * Similar to realpath(), but supports tilde-expansion, i.e. "~", "~/..." and "~user/...". These paths are expanded using shell-like rules.
   */
  ext_openssh_expandPath(path: string, callback: (err: Error | undefined, absPath: string) => void): void;

  /**
   * (Client-only)
   * Performs a remote file copy. If length is 0, then the server will read from srcHandle until EOF is reached.
   */
  ext_copy_data(
    handle: Buffer,
    srcOffset: number,
    len: number,
    dstHandle: Buffer,
    dstOffset: number,
    callback: Callback,
  ): void;

  /**
   * Emitted after initial protocol version check has passed
   */
  on(event: "ready", listener: () => void): this;
  on(event: "OPEN", listener: (reqId: number, filename: string, flags: number, attrs: Attributes) => void): this;
  on(event: "READ", listener: (reqId: number, handle: Buffer, offset: number, len: number) => void): this;
  on(event: "WRITE", listener: (reqId: number, handle: Buffer, offset: number, data: Buffer) => void): this;
  on(event: "FSTAT", listener: (reqId: number, handle: Buffer) => void): this;
  on(event: "FSETSTAT", listener: (reqId: number, handle: Buffer, attrs: Attributes) => void): this;
  on(event: "CLOSE", listener: (reqId: number, handle: Buffer) => void): this;
  on(event: "OPENDIR", listener: (reqId: number, path: string) => void): this;
  on(event: "READDIR", listener: (reqId: number, handle: Buffer) => void): this;
  on(event: "LSTAT", listener: (reqId: number, path: string) => void): this;
  on(event: "STAT", listener: (reqId: number, path: string) => void): this;
  on(event: "REMOVE", listener: (reqId: number, path: string) => void): this;
  on(event: "RMDIR", listener: (reqId: number, path: string) => void): this;
  on(event: "REALPATH", listener: (reqId: number, path: string) => void): this;
  on(event: "READLINK", listener: (reqId: number, path: string) => void): this;
  on(event: "SETSTAT", listener: (reqId: number, path: string, attrs: Attributes) => void): this;
  on(event: "MKDIR", listener: (reqId: number, path: string, attrs: Attributes) => void): this;
  on(event: "RENAME", listener: (reqId: number, oldPath: string, newPath: string) => void): this;
  on(event: "SYMLINK", listener: (reqId: number, targetPath: string, linkPath: string) => void): this;
  on(event: "EXTENDED", listener: (reqId: number, extName: string, extData: Buffer) => void): this;
  on(event: string | symbol, listener: () => any): this;

  /**
   * Sends a status response for the request identified by id.
   */
  status(reqId: number, code: number, message?: string): void;

  /**
   * Sends a handle response for the request identified by id.
   * handle must be less than 256 bytes and is an opaque value that could merely contain the value of a
   * backing file descriptor or some other unique, custom value.
   */
  handle(reqId: number, handle: Buffer): void;

  /**
   * Sends a data response for the request identified by id. data can be a Buffer or string.
   * If data is a string, encoding is the encoding of data.
   */
  data(reqId: number, data: Buffer | string, encoding?: BufferEncoding): void;

  /**
   * Sends a name response for the request identified by id.
   */
  name(reqId: number, names: FileEntry[]): void;

  /**
   * Sends an attrs response for the request identified by id.
   */
  attrs(reqId: number, attrs: Attributes): void;

  /**
   * Closes the channel.
   */
  end(): void;

  /**
   * Closes the channel.
   */
  destroy(): void;
}


export interface TransferOptions {
  concurrency?: number;
  chunkSize?: number;
  fileSize?: number;
  step?: (total: number, nb: number, fsize: number) => void;
  mode?: number | string;
}

export type Callback = (err?: Error | null) => void;

export interface ReadFileOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface ReadStreamOptions extends ReadableOptions {
  flags?: OpenMode;
  mode?: number;
  start?: number;
  end?: number;
  autoClose?: boolean;
  handle?: Buffer;
}


export interface WriteStreamOptions extends WritableOptions {
  flags?: OpenMode;
  mode?: number;
  start?: number;
  autoClose?: boolean;
  handle?: Buffer;
  encoding?: BufferEncoding;
}

export interface InputAttributes {
  mode?: number | string;
  uid?: number;
  gid?: number;
  size?: number;
  atime?: number | Date;
  mtime?: number | Date;
}

export interface FileEntryWithStats extends Omit<FileEntry, "attrs"> {
  attrs: Stats;
}

export interface FileEntry {
  filename: string;
  longname: string;
  attrs: Attributes;
}

export interface Attributes {
  mode: number;
  uid: number;
  gid: number;
  size: number;
  atime: number;
  mtime: number;
}
