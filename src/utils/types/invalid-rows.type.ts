/**
 * @example ```
 * {
 *    email: [
 *      "invalid email",
 *      "email cant be empty"
 *    ],
 *    name: [
 *      "email cant be empty"
 *    ],
 * }
 * ```
 */
export type InvalidRowsType = { [field: string]: string };
