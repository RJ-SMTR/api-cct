
/**
 * A standadized way to store and type check complex objects
 */
export interface Metadata {
  type: string,
  extends?: string,
}

/**
 * Customize and change you metadata to satisfy your objects.
 * 
 * Example: type is optional, type is 'MyObject'.
 */
export type MetadataAs<T extends Metadata> = T & Metadata;

