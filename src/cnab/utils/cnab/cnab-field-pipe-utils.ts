import { CommonHttpException } from "src/utils/http-exception/common-http-exception";
import { asNumberStringDate } from "src/utils/pipe-utils";
import { CnabField } from "../../interfaces/cnab-all/cnab-field.interface";
import { getPictureNumberSize } from "./cnab-field-utils";

export function asCnabFieldDate(field: CnabField) {
  if (!field.format?.dateFormat) {
    throw CommonHttpException.details(
      `Expected CnabField date with defined dateFormat. ${JSON.stringify(field)}`);
  }
  return asNumberStringDate(field.value, field?.format?.dateFormat);
}

export function asCnabFieldNumber(field: CnabField) {
  const { decimal } = getPictureNumberSize(field.picture);
  const num = Number(field.value) / (10 * decimal);
  return num;
}


