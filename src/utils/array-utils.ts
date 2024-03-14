/**
 * Returns if two arrays are equal ignoring the order.
 */
export function isArrayContainEqual(arr1: any[], arr2: any[]): boolean {
  const arr1_ = arr1;
  arr1_.sort();
  const arr2_ = arr2;
  arr2_.sort();
  return arr1_.length == arr2_.length && arr1_.every((u, i) => u === arr2_[i]);
}

export function groupArrayBy<T>(array: T[], property: keyof T): T[][] {
  const uniqueValues = Array.from(new Set(array.map(obj => obj[property]))) as (string | number)[];
  const groupedArray = uniqueValues.map(value =>
    array.filter(obj => obj[property] === value)
  );
  return groupedArray;
}
