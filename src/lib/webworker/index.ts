/**
 * WebWorker base classes for type-safe communication using Comlink
 *
 * @module webworker
 */

export { WebWorkerClient } from './WebWorkerClient.js';
export { WebWorkerService } from './WebWorkerService.js';
export {
	WebWorkerError,
	type AsyncMethods,
	type MethodParams,
	type MethodReturnType,
	type CacheEntry,
	type WebWorkerClientOptions
} from './types.js';
