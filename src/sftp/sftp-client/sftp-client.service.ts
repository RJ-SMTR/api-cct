import { Injectable, Logger } from '@nestjs/common';
import * as SftpClient from 'ssh2-sftp-client';
import { ConnectConfig } from '../interfaces/connect-config.interface';
import { FileInfo } from '../interfaces/file-info.interface';
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class SftpClientService {
  private readonly logger: CustomLogger;
  private sftpClient: SftpClient;
  constructor() {
    this.logger = new CustomLogger('SftpClientService');
    this.sftpClient = new SftpClient();
  }

  client() {
    return this.sftpClient;
  }

  /**
   * Resets the sftp connection, updates/creates the connection used in initialization.
   */
  async resetConnection(config: ConnectConfig): Promise<void> {
    try {
      await this.sftpClient.end();
      await this.sftpClient.connect(config);
    } catch (ex) {
      if (ex.code === 'ERR_NOT_CONNECTED') {
        await this.sftpClient.connect(config);
      } else {
        throw ex;
      }
    }
  }

  /**
   * Closes the current connection.
   */
  async disconnect() {
    await this.sftpClient.end();
  }

  /**
   * Returns the attributes associated with the object pointed to by remotePath
   *
   * @param remotePath the remote file location
   *
   * @returns
   * ```
   * let stats = {
   *   mode: 33279, // integer representing type and permissions
   *   uid: 1000, // user ID
   *   gid: 985, // group ID
   *   size: 5, // file size
   *   accessTime: 1566868566000, // Last access time. milliseconds
   *   modifyTime: 1566868566000, // last modify time. milliseconds
   *   isDirectory: false, // true if object is a directory
   *   isFile: true, // true if object is a file
   *   isBlockDevice: false, // true if object is a block device
   *   isCharacterDevice: false, // true if object is a character device
   *   isSymbolicLink: false, // true if object is a symbolic link
   *   isFIFO: false, // true if object is a FIFO
   *   isSocket: false // true if object is a socket
   * };
   * ```
   */
  async stat(remotePath: string): Promise<SftpClient.FileStats> {
    return await this.sftpClient.stat(remotePath);
  }

  /**
   * Converts a relative path to an absolute path on the remote server.
   * This method is mainly used internally to resolve remote path names.
   * Returns '' if the path is not valid.
   *
   * @param remotePath A file path, either relative or absolute. Can handle '.' and '..', but does not expand '~'.
   */
  async realPath(remotePath: string): Promise<string> {
    return await this.sftpClient.realPath(remotePath);
  }

  async upload(
    contents: string | Buffer | NodeJS.ReadableStream,
    remoteFilePath: string,
    transferOptions?: SftpClient.TransferOptions,
  ): Promise<string> {
    return await this.sftpClient.put(contents, remoteFilePath, transferOptions);
  }

  /**
   * Retrieves a directory listing. This method returns a Promise, which once realised,
   * returns an array of objects representing items in the remote directory.
   *
   * @param remoteDirectory {String} Remote directory path
   * @param filter If string, filter where item.name includes filter substring.
   * If RegExp, apply to item name.
   * If function, it will add if return is `true`.
   * If no filter, all items wil be returned.
   */
  async list(
    remoteDirectory: string,
    filter?: string | RegExp | ((item: FileInfo) => boolean),
  ): Promise<FileInfo[]> {
    return await this.sftpClient.list(remoteDirectory, (item: FileInfo) => {
      if (typeof filter === 'function') {
        return filter(item);
      }
      else if (typeof filter === 'string') {
        return item.name.includes(filter);
      }
      else if (filter) {
        return item.name.match(filter);
      }
      else {
        return true;
      }
    });
  }

  /**
   * Retrieve a file from a remote SFTP server.
   * The dst argument defines the destination and can be either a string,
   * a stream object or undefined. If it is a string, it is interpreted as the
   * path to a location on the local file system (path should include the file name).
   * If it is a stream object, the remote data is passed to it via a call to pipe().
   * If dst is undefined, the method will put the data into a buffer and return that buffer when the Promise is resolved.
   * If dst is defined, it is returned when the Promise is resolved.
   *
   * @param path String. Path to the remote file to download
   * @param dst String|Stream. Destination for the data. If a string, it should be a local file path.
   * @param options ```
   * {
   *   flags: 'r',
   *   encoding: null,
   *   handle: null,
   *   mode: 0o666,
   *   autoClose: true
   * }
   * ```
   */
  async download(
    path: string,
    dst?: string | NodeJS.WritableStream,
    options?: SftpClient.TransferOptions,
  ): Promise<string | NodeJS.WritableStream | Buffer> {
    return await this.sftpClient.get(path, dst, options);
  }

  async delete(remoteFilePath: string): Promise<void> {
    await this.sftpClient.delete(remoteFilePath);
  }

  async makeDirectory(remoteFilePath: string, recursive = true): Promise<void> {
    await this.sftpClient.mkdir(remoteFilePath, recursive);
  }

  async removeDirectory(
    remoteFilePath: string,
    recursive = true,
  ): Promise<void> {
    await this.sftpClient.rmdir(remoteFilePath, recursive);
  }

  async rename(
    remoteSourcePath: string,
    remoteDestinationPath: string,
    overwrite?: boolean,
  ): Promise<void> {
    if (overwrite) {
      if (await this.exists(remoteDestinationPath)) {
        this.logger.debug(`Overwriting existing path before rename: ${remoteDestinationPath}`);
        await this.delete(remoteDestinationPath);
      }
    }
    await this.sftpClient.rename(remoteSourcePath, remoteDestinationPath);
  }

  /**
   * Tests to see if remote file or directory exists.
   * Returns type of remote object if it exists or false if it does not.
   *
   * @param remotePath
   * @returns false or d, -, l (dir, file or link)
   */
  async exists(remotePath: string): Promise<false | 'd' | '-' | 'l'> {
    return await this.sftpClient.exists(remotePath);
  }

  async connect(config: ConnectConfig) {
    await this.sftpClient.connect(config);
  }

}
