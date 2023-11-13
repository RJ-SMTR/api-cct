export interface INodeException {
  /** @example 'Error: connect ECONNREFUSED 127.0.0.1:5555' */
  message: string;

  errno: number;

  /** @example 'ESOCKET' */
  code: string;

  /** @example 'connect' */
  syscall: string;

  /** @example '127.0.0.1' */
  address: string;

  port: number;

  /** @example 'CONN' */
  command: string;
}
