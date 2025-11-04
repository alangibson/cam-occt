/**
 * WebWorker base classes for type-safe communication using Comlink
 *
 * @module webworker
 */

export { WebWorker } from './WebWorker.js';
export { WorkerService } from './WorkerService.js';
export {
	WebWorkerError,
	type AsyncMethods,
	type MethodParams,
	type MethodReturnType,
	type CacheEntry,
	type WebWorkerOptions
} from './types.js';
