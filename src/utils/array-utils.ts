export function isArrayContainEqual(arr1: any[], arr2: any[]): boolean {
  return (
    arr1.length == arr2.length &&
    arr1.every(function (u, i) {
      return u === arr2[i];
    })
  );
}
