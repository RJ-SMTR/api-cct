/**
 * Interface defining method called once the host module has been initialized and async.
 * 
 * Usage example:
 * 
 * ```typescript
 * onModuleInit() {
 *     this.onModuleLoad().catch((error: Error) => { throw error; });
 * }
 * 
 * async onModuleLoad(){
 *    await this.doSomethingAsync();
 * }
 * ```
 */
export interface OnModuleLoad {
  onModuleLoad(): Promise<any>;
}