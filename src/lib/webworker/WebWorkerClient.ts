/**
 * Base class for WebWorker clients on the main thread
 *
 * Provides type-safe async method dispatching to WebWorkers using JSON-RPC 2.0 protocol.
 * Results from the last call are cached automatically.
 *
 * @example
 * // Define service interface
 * interface MathService {
 *   add(a: number, b: number): Promise<number>;
 *   multiply(a: number, b: number): Promise<number>;
 * }
 *
 * // Create client class
 * class MathClient extends WebWorkerClient<MathService> {
 *   async add(a: number, b: number) {
 *     return this.call('add', a, b);
 *   }
 *
 *   async multiply(a: number, b: number) {
 *     return this.call('multiply', a, b);
 *   }
 * }
 *
 * // Use it
 * const math = new MathClient(new Worker('./math.worker.ts', { type: 'module' }));
 * const result = await math.add(2, 3); // 5
 */

import type {
	JsonRpcRequest,
	JsonRpcResponse,
	JsonRpcErrorResponse,
	CacheEntry
} from './types.js';
import { JsonRpcErrorCode, WebWorkerError } from './types.js';

export abstract class WebWorkerClient<TService> {
	private worker: Worker;
	private requestId = 0;
	private pendingRequests = new Map<
		number,
		{
			resolve: (value: any) => void;
			reject: (error: Error) => void;
			method: string;
			params: any[];
		}
	>();
	private lastCallCache = new Map<string, CacheEntry>();
	private disposed = false;

	/**
	 * Create a new WebWorker client
	 * @param worker - The Worker instance to communicate with
	 */
	constructor(worker: Worker) {
		this.worker = worker;
		this.worker.onmessage = this.handleMessage.bind(this);
		this.worker.onerror = this.handleError.bind(this);
		this.worker.onmessageerror = this.handleMessageError.bind(this);
	}

	/**
	 * Call a method on the worker service
	 * @param method - The method name to call
	 * @param params - The parameters to pass to the method
	 * @returns Promise that resolves with the method's return value
	 * @throws {WebWorkerError} If communication fails or method execution fails
	 */
	protected async call<K extends keyof TService>(
		method: K,
		...params: any[]
	): Promise<any> {
		if (this.disposed) {
			throw new WebWorkerError(
				'Worker client has been disposed',
				JsonRpcErrorCode.InternalError
			);
		}

		// Check cache for last call with same method and params
		const cacheKey = this.getCacheKey(String(method), params);
		const cached = this.lastCallCache.get(cacheKey);
		if (cached) {
			return cached.result;
		}

		const id = ++this.requestId;
		const request: JsonRpcRequest = {
			jsonrpc: '2.0',
			method: String(method),
			params,
			id
		};

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve,
				reject,
				method: String(method),
				params
			});

			try {
				this.worker.postMessage(request);
			} catch (error) {
				this.pendingRequests.delete(id);
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				reject(
					new WebWorkerError(
						`Failed to send message to worker: ${errorMessage}`,
						JsonRpcErrorCode.InternalError,
						error
					)
				);
			}
		});
	}

	/**
	 * Handle incoming messages from the worker
	 */
	private handleMessage(event: MessageEvent<JsonRpcResponse>): void {
		const response = event.data;

		// Validate JSON-RPC response
		if (!response || response.jsonrpc !== '2.0' || typeof response.id !== 'number') {
			console.error('Invalid JSON-RPC response:', response);
			return;
		}

		const pending = this.pendingRequests.get(response.id);
		if (!pending) {
			console.warn('Received response for unknown request ID:', response.id);
			return;
		}

		this.pendingRequests.delete(response.id);

		// Check if error response
		if ('error' in response) {
			const errorResponse = response as JsonRpcErrorResponse;
			pending.reject(
				new WebWorkerError(
					errorResponse.error.message,
					errorResponse.error.code,
					errorResponse.error.data
				)
			);
		} else {
			// Success - cache the result
			const cacheKey = this.getCacheKey(pending.method, pending.params);
			this.lastCallCache.clear(); // Only keep last call
			this.lastCallCache.set(cacheKey, {
				params: pending.params,
				result: response.result,
				timestamp: Date.now()
			});

			pending.resolve(response.result);
		}
	}

	/**
	 * Handle worker errors
	 */
	private handleError(error: ErrorEvent): void {
		const workerError = new WebWorkerError(
			`Worker error: ${error.message}`,
			JsonRpcErrorCode.InternalError,
			{ filename: error.filename, lineno: error.lineno, colno: error.colno }
		);

		// Reject all pending requests
		for (const [id, pending] of this.pendingRequests) {
			pending.reject(workerError);
		}
		this.pendingRequests.clear();
	}

	/**
	 * Handle message deserialization errors
	 */
	private handleMessageError(event: MessageEvent): void {
		const error = new WebWorkerError(
			'Failed to deserialize message from worker',
			JsonRpcErrorCode.ParseError,
			event.data
		);

		// Reject all pending requests since we can't match the response to a request
		for (const [id, pending] of this.pendingRequests) {
			pending.reject(error);
		}
		this.pendingRequests.clear();
	}

	/**
	 * Generate a cache key from method name and parameters
	 */
	private getCacheKey(method: string, params: any[]): string {
		return `${method}:${JSON.stringify(params)}`;
	}

	/**
	 * Get the number of pending requests
	 */
	protected getPendingCount(): number {
		return this.pendingRequests.size;
	}

	/**
	 * Clear the result cache
	 */
	protected clearCache(): void {
		this.lastCallCache.clear();
	}

	/**
	 * Dispose of the worker and clean up resources
	 */
	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;

		// Reject all pending requests
		const error = new WebWorkerError(
			'Worker client disposed',
			JsonRpcErrorCode.InternalError
		);
		for (const [id, pending] of this.pendingRequests) {
			pending.reject(error);
		}
		this.pendingRequests.clear();
		this.lastCallCache.clear();

		// Terminate the worker
		this.worker.terminate();
	}
}
