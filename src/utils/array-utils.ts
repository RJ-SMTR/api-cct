export function isArrayContainEqual(arr1: any[], arr2: any[]): boolean {
  const arr1_ = arr1;
  arr1_.sort();
  const arr2_ = arr2;
  arr2_.sort();
  return (
    arr1_.length == arr2_.length &&
    arr1_.every(function (u, i) {
      return u === arr2_[i];
    })
  );
}
