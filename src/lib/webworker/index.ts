/**
 * WebWorker base classes for type-safe JSON-RPC communication
 *
 * @module webworker
 */

export { WebWorkerClient } from './WebWorkerClient.js';
export { WebWorkerService } from './WebWorkerService.js';
export {
	JsonRpcErrorCode,
	WebWorkerError,
	type JsonRpcRequest,
	type JsonRpcResponse,
	type JsonRpcSuccessResponse,
	type JsonRpcErrorResponse,
	type AsyncMethods,
	type MethodParams,
	type MethodReturnType,
	type CacheEntry
} from './types.js';
