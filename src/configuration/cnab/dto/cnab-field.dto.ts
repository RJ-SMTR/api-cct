import { CnabField } from '../interfaces/cnab-all/cnab-field.interface';

interface ICnabFieldMetadata {
  fieldName: string,
  registroName: string,
  loteNumber?: number,
  cnabName?: string,
}

export class CnabFieldDTO {
  public cnabField: CnabField;
  private metadata: ICnabFieldMetadata;
  private readonly _typeof = 'CnabFieldDto';

  constructor(cnabField: CnabField, metadata: ICnabFieldMetadata) {
    this.cnabField = cnabField;
    this.metadata = metadata;
  }
}
