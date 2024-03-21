export type IsTypeOfList =
  'ANDConditions'
  | 'ORConditions'
  ;

  /**
   * Check custom objects with _typeof attribute
   */
export function isTypeof(obj: any, typeName: IsTypeOfList) {
  return obj?._typeof === typeName;
}
