import { Duplex } from "stream";
import { Readable } from "typeorm/platform/PlatformTools";

export interface ConnectConfig {
  /** Hostname or IP address of the server. */
  host?: string;
  /** Port number of the server. */
  port?: number;
  /** Only connect via resolved IPv4 address for `host`. */
  forceIPv4?: boolean;
  /** Only connect via resolved IPv6 address for `host`. */
  forceIPv6?: boolean;
  /** The host's key is hashed using this method and passed to `hostVerifier`. */
  hostHash?: string;
  /** Verifies a hexadecimal hash of the host's key. */
  hostVerifier?: HostVerifier | SyncHostVerifier | HostFingerprintVerifier | SyncHostFingerprintVerifier;
  /** Username for authentication. */
  username?: string;
  /** Password for password-based user authentication. */
  password?: string;
  /** Path to ssh-agent's UNIX socket for ssh-agent-based user authentication (or 'pageant' when using Pagent on Windows). */
  agent?: BaseAgent | string;
  /** Buffer or string that contains a private key for either key-based or hostbased user authentication (OpenSSH format). */
  privateKey?: Buffer | string;
  /** For an encrypted private key, this is the passphrase used to decrypt it. */
  passphrase?: Buffer | string;
  /** Along with `localUsername` and `privateKey`, set this to a non-empty string for hostbased user authentication. */
  localHostname?: string;
  /** Along with `localHostname` and `privateKey`, set this to a non-empty string for hostbased user authentication. */
  localUsername?: string;
  /** Try keyboard-interactive user authentication if primary user authentication method fails. */
  tryKeyboard?: boolean;
  /** How often (in milliseconds) to send SSH-level keepalive packets to the server. Set to 0 to disable. */
  keepaliveInterval?: number;
  /** How many consecutive, unanswered SSH-level keepalive packets that can be sent to the server before disconnection. */
  keepaliveCountMax?: number;
  /** * How long (in milliseconds) to wait for the SSH handshake to complete. */
  readyTimeout?: number;
  /** Performs a strict server vendor check before sending vendor-specific requests. */
  strictVendor?: boolean;
  /** A `ReadableStream` to use for communicating with the server instead of creating and using a new TCP connection (useful for connection hopping). */
  sock?: Readable;
  /** Set to `true` to use OpenSSH agent forwarding (`auth-agent@openssh.com`) for the life of the connection. */
  agentForward?: boolean;
  /** Explicit overrides for the default transport layer algorithms used for the connection. */
  algorithms?: Algorithms;
  /** A function that receives a single string argument to get detailed (local) debug information. */
  debug?: DebugFunction;
  /** Function with parameters (methodsLeft, partialSuccess, callback) where methodsLeft and partialSuccess are null on the first authentication attempt, otherwise are an array and boolean respectively. Return or call callback() with the name of the authentication method to try next (pass false to signal no more methods to try). Valid method names are: 'none', 'password', 'publickey', 'agent', 'keyboard-interactive', 'hostbased'. Default: function that follows a set method order: None -> Password -> Private Key -> Agent (-> keyboard-interactive if tryKeyboard is true) -> Hostbased. */
  authHandler?: AuthenticationType[] | AuthHandlerMiddleware | AuthMethod[];
  /** IP address of the network interface to use to connect to the server. Default: (none -- determined by OS) */
  localAddress?: string;
  /** The local port number to connect from. Default: (none -- determined by OS) */
  localPort?: number;
  /** The underlying socket timeout in ms. Default: none) */
  timeout?: number;
  /** A custom server software name/version identifier. Default: 'ssh2js' + moduleVersion + 'srv' */
  ident?: Buffer | string;
}

export type AuthHandlerMiddleware = (
  authsLeft: AuthenticationType[],
  partialSuccess: boolean,
  next: NextAuthHandler,
) => void;
export type NextAuthHandler = (authName: AuthenticationType | AnyAuthMethod) => void;

export type AnyAuthMethod =
  | NoAuthMethod
  | PasswordAuthMethod
  | HostBasedAuthMethod
  | PublicKeyAuthMethod
  | AgentAuthMethod
  | KeyboardInteractiveAuthMethod;


/**
 * Strategy returned from the {@link ConnectConfig.authHandler} to connect with an agent.
 */
export interface KeyboardInteractiveAuthMethod extends AuthMethod {
  type: "keyboard-interactive";
  /**
   * This works exactly the same way as a 'keyboard-interactive' client event handler
   */
  prompt(
    name: string,
    instructions: string,
    lang: string,
    prompts: Prompt[],
    finish: KeyboardInteractiveCallback,
  ): void;
}
export type KeyboardInteractiveCallback = (answers: string[]) => void;


export interface Prompt {
  prompt: string;
  echo?: boolean;
}

export interface AuthMethod {
  type: AuthenticationType;
  username: string;
}

/**
 * Strategy returned from the {@link ConnectConfig.authHandler} to connect without authentication.
 */
export interface NoAuthMethod extends AuthMethod {
  type: "none";
}

/**
 * Strategy returned from the {@link ConnectConfig.authHandler} to connect with a password.
 */
export interface PasswordAuthMethod extends AuthMethod {
  type: "password";
  password: string;
}

/**
 * Strategy returned from the {@link ConnectConfig.authHandler} to connect with a public key.
 */
export interface PublicKeyAuthMethod extends AuthMethod {
  type: "publickey";
  key: ParsedKey | Buffer | string;
  passphrase?: Buffer | string;
}

/**
 * Strategy returned from the {@link ConnectConfig.authHandler} to connect with host-based authentication.
 */
export interface HostBasedAuthMethod extends AuthMethod {
  type: "hostbased";
  localHostname: string;
  localUsername: string;
  /**
   * Can be a string, Buffer, or parsed key containing a private key
   */
  key: ParsedKey | Buffer | string;
  /**
   * `passphrase` only required for encrypted keys
   */
  passphrase?: Buffer | string;
}

/**
 * Strategy returned from the {@link ConnectConfig.authHandler} to connect with an agent.
 */
export interface AgentAuthMethod extends AuthMethod {
  type: "agent";
  /**
   * Can be a string that is interpreted exactly like the `agent` connection config
   * option or can be a custom agent object/instance that extends and implements `BaseAgent`
   */
  agent: BaseAgent | string;
}

export type VerifyCallback = (valid: boolean) => void;

export type HostVerifier = (key: Buffer, verify: VerifyCallback) => void;
export type SyncHostVerifier = (key: Buffer) => boolean;
export type HostFingerprintVerifier = (fingerprint: string, verify: VerifyCallback) => boolean;
export type SyncHostFingerprintVerifier = (fingerprint: string) => boolean;
export type DebugFunction = (message: string) => void;
export type AuthenticationType = "password" | "publickey" | "hostbased" | "agent" | "keyboard-interactive" | "none";

export abstract class BaseAgent<TPublicKey extends string | Buffer | ParsedKey = string | Buffer | ParsedKey> {
  /**
   * Retrieves user identities, where `keys` is a possible array of public
   * keys for authentication.
   */
  abstract getIdentities(cb: IdentityCallback<TPublicKey>): void;

  /**
   * Signs the datawith the given public key, and calls back with its signature.
   * Note that, in the current implementation, "options" is always an empty object.
   */
  abstract sign(pubKey: TPublicKey, data: Buffer, options: SigningRequestOptions, cb?: SignCallback): void;
  abstract sign(pubKey: TPublicKey, data: Buffer, cb: SignCallback): void;

  /**
   * Optional method that may be implemented to support agent forwarding. Callback
   * should be invoked with a Duplex stream to be used to communicate with your agent/
   * You will probably want to utilize `AgentProtocol` as agent forwarding is an
   * OpenSSH feature, so the `stream` needs to be able to
   * transmit/receive OpenSSH agent protocol packets.
   */
  getStream?(cb: GetStreamCallback): void;
}
export type GetStreamCallback = (err?: Error | null, stream?: Duplex) => void;

export type SignCallback = (err?: Error | null, signature?: Buffer) => void;

export interface SigningRequestOptions {
  hash?: "sha1" | "sha256" | "sha512";
}

export type IdentityCallback<T extends string | Buffer | ParsedKey = string | Buffer | ParsedKey> = (
  err?: Error | null,
  keys?: KnownPublicKeys<T>,
) => void;

export type KnownPublicKeys<T extends string | Buffer | ParsedKey = string | Buffer | ParsedKey> = Array<
  | T
  | PublicKeyEntry
>;

export interface PublicKeyEntry {
  pubKey:
  | ParsedKey
  | {
    pubKey: ParsedKey | Buffer | string;
    comment?: string;
  };
}

/**
 * Overrides for the default transport layer algorithms used for the connection.
 *
 * The order of the algorithms in the arrays are important, with the most favorable being first.
 */
export interface Algorithms {
  kex?: AlgorithmList<KexAlgorithm>;
  cipher?: AlgorithmList<CipherAlgorithm>;
  serverHostKey?: AlgorithmList<ServerHostKeyAlgorithm>;
  hmac?: AlgorithmList<MacAlgorithm>;
  compress?: AlgorithmList<CompressionAlgorithm>;
}

/**
 * Possible Key Exchange Algorithms
 */
export type KexAlgorithm =
  | "curve25519-sha256"
  | "curve25519-sha256@libssh.org"
  | "ecdh-sha2-nistp256"
  | "ecdh-sha2-nistp384"
  | "ecdh-sha2-nistp521"
  | "diffie-hellman-group-exchange-sha256"
  | "diffie-hellman-group14-sha256"
  | "diffie-hellman-group15-sha512"
  | "diffie-hellman-group16-sha512"
  | "diffie-hellman-group17-sha512"
  | "diffie-hellman-group18-sha512"
  | "diffie-hellman-group-exchange-sha1"
  | "diffie-hellman-group14-sha1"
  | "diffie-hellman-group1-sha1";

export type ServerHostKeyAlgorithm =
  | "ssh-ed25519"
  | "ecdsa-sha2-nistp256"
  | "ecdsa-sha2-nistp384"
  | "ecdsa-sha2-nistp521"
  | "rsa-sha2-512"
  | "rsa-sha2-256"
  | "ssh-rsa"
  | "ssh-dss";

export type CompressionAlgorithm = "none" | "zlib" | "zlib@openssh.com";

export type CipherAlgorithm =
  | "chacha20-poly1305@openssh.com"
  | "aes128-gcm"
  | "aes128-gcm@openssh.com"
  | "aes256-gcm"
  | "aes256-gcm@openssh.com"
  | "aes128-ctr"
  | "aes192-ctr"
  | "aes256-ctr"
  | "aes256-cbc"
  | "aes192-cbc"
  | "aes128-cbc"
  | "blowfish-cbc"
  | "3des-cbc"
  | "arcfour256"
  | "arcfour128"
  | "cast128-cbc"
  | "arcfour";

export type MacAlgorithm =
  | "hmac-sha2-256-etm@openssh.com"
  | "hmac-sha2-512-etm@openssh.com"
  | "hmac-sha1-etm@openssh.com"
  | "hmac-sha2-256"
  | "hmac-sha2-512"
  | "hmac-sha1"
  | "hmac-md5"
  | "hmac-sha2-256-96"
  | "hmac-sha2-512-96"
  | "hmac-ripemd160"
  | "hmac-sha1-96"
  | "hmac-md5-96";

/**
 * Lists of supported algorithms can either be an ordered array of all supported algorithms,
 * OR a map of algorithms to manipulate the default list
 */
export type AlgorithmList<T> = T[] | Record<"append" | "prepend" | "remove", T | T[]>;


export interface ParsedKey {
  type: KeyType;
  comment: string;
  sign(data: Buffer | string, algo?: string): Buffer;
  verify(data: Buffer | string, signature: Buffer, algo?: string): boolean;
  isPrivateKey(): boolean;
  getPrivatePEM(): string;
  getPublicPEM(): string;
  getPublicSSH(): Buffer;
  equals(key: Buffer | string | ParsedKey): boolean;
}
