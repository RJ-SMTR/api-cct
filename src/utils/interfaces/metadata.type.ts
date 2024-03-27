
export interface IMetadata {
  type?: string,
  extends?: string,
}

export type Metadata<T> = {
  _metdata?: IMetadata
} & T
