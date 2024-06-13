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

export function groupBy<T>(array: T[], property: keyof T): T[][] {
  const uniqueValues = Array.from(
    new Set(array.map((obj) => obj[property])),
  ) as (string | number)[];
  const groupedArray = uniqueValues.map((value) =>
    array.filter((obj) => obj[property] === value),
  );
  return groupedArray;
}

/**
 * Returns a list containing first item of same property
 */
export function getFirstOfEach<T>(array: T[], property: keyof T): T[] {
  const groupDict = array.reduce((map: Record<string, T>, item) => {
    if (!map[String(property)]) {
      map[String(property)] = item;
    }
    return map;
  }, {});
  return Object.values(groupDict);
}

export function getUniqueFromArray<T>(
  items: T[],
  uniqueKeys: (keyof T)[],
): T[] {
  const uniqueItems: T[] = [];
  const keySet = new Set<string>();
  for (const item of items) {
    const uniqueKeyId = uniqueKeys.map((key) => String(item[key])).join('|');
    // get only first unique item
    if (!keySet.has(uniqueKeyId)) {
      keySet.add(uniqueKeyId);
      uniqueItems.push(item);
    }
  }
  return uniqueItems;
}

export function filterArrayInANotInB<T>(listA: T[], listB: T[]): T[] {
  return listA.filter((itemA) => !listB.includes(itemA));
}

export function getChunks<T>(array: T[], length: number) {
  const buffer = structuredClone(array);
  const chunks: T[][] = [];
  while (buffer.length) {
    chunks.push(buffer.splice(0, length));
  }
  return chunks;
}

export function forChunk<T>(
  array: T[],
  length: number,
  callback: (chunk: T[]) => void,
) {
  const buffer = structuredClone(array);
  while (buffer.length) {
    const chunk = buffer.splice(0, length);
    callback(chunk);
  }
}
