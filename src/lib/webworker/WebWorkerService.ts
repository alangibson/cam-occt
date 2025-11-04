/**
 * Base class for WebWorker services that run in the worker thread
 *
 * Receives JSON-RPC 2.0 requests and dispatches them to service methods.
 * Automatically handles errors and sends responses back to the main thread.
 *
 * @example
 * // math.worker.ts
 * import { WebWorkerService } from './WebWorkerService';
 *
 * interface MathService {
 *   add(a: number, b: number): Promise<number>;
 *   multiply(a: number, b: number): Promise<number>;
 * }
 *
 * class MathServiceImpl extends WebWorkerService<MathService> implements MathService {
 *   async add(a: number, b: number): Promise<number> {
 *     return a + b;
 *   }
 *
 *   async multiply(a: number, b: number): Promise<number> {
 *     return a * b;
 *   }
 * }
 *
 * // Initialize the service
 * new MathServiceImpl();
 */

import type { JsonRpcRequest, JsonRpcSuccessResponse, JsonRpcErrorResponse } from './types.js';
import { JsonRpcErrorCode, WebWorkerError } from './types.js';

export abstract class WebWorkerService<TService> {
	/**
	 * Initialize the service and start listening for messages
	 */
	constructor() {
		self.onmessage = this.handleMessage.bind(this);
	}

	/**
	 * Handle incoming JSON-RPC requests
	 */
	private async handleMessage(event: MessageEvent<JsonRpcRequest>): Promise<void> {
		const request = event.data;

		// Validate JSON-RPC request
		if (!this.isValidRequest(request)) {
			this.sendErrorResponse(
				request?.id ?? null,
				JsonRpcErrorCode.InvalidRequest,
				'Invalid JSON-RPC request',
				request
			);
			return;
		}

		try {
			// Check if method exists on service
			const method = (this as any)[request.method];
			if (typeof method !== 'function') {
				this.sendErrorResponse(
					request.id,
					JsonRpcErrorCode.MethodNotFound,
					`Method '${request.method}' not found`,
					{ method: request.method }
				);
				return;
			}

			// Validate params is an array
			if (!Array.isArray(request.params)) {
				this.sendErrorResponse(
					request.id,
					JsonRpcErrorCode.InvalidParams,
					'Params must be an array',
					{ params: request.params }
				);
				return;
			}

			// Call the method with parameters
			const result = await method.apply(this, request.params);

			// Send success response
			this.sendSuccessResponse(request.id, result);
		} catch (error) {
			// Handle method execution errors
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorCode =
				error instanceof WebWorkerError ? error.code : JsonRpcErrorCode.InternalError;
			const errorData = error instanceof WebWorkerError ? error.data : undefined;

			this.sendErrorResponse(request.id, errorCode, errorMessage, errorData);
		}
	}

	/**
	 * Validate that the request conforms to JSON-RPC 2.0 spec
	 */
	private isValidRequest(request: any): request is JsonRpcRequest {
		return (
			request &&
			typeof request === 'object' &&
			request.jsonrpc === '2.0' &&
			typeof request.method === 'string' &&
			typeof request.id === 'number'
		);
	}

	/**
	 * Send a success response to the main thread
	 */
	private sendSuccessResponse(id: number, result: any): void {
		const response: JsonRpcSuccessResponse = {
			jsonrpc: '2.0',
			result,
			id
		};

		try {
			self.postMessage(response);
		} catch (error) {
			console.error('Failed to send success response:', error);
			// Try to send an error response instead
			this.sendErrorResponse(
				id,
				JsonRpcErrorCode.InternalError,
				'Failed to serialize result',
				error
			);
		}
	}

	/**
	 * Send an error response to the main thread
	 */
	private sendErrorResponse(
		id: number | null,
		code: JsonRpcErrorCode,
		message: string,
		data?: any
	): void {
		const response: JsonRpcErrorResponse = {
			jsonrpc: '2.0',
			error: {
				code,
				message,
				...(data !== undefined && { data })
			},
			id: id ?? -1 // Use -1 for invalid requests without an ID
		};

		try {
			self.postMessage(response);
		} catch (error) {
			console.error('Failed to send error response:', error);
		}
	}

	/**
	 * Log a message from the worker (helpful for debugging)
	 */
	protected log(...args: any[]): void {
		console.log('[Worker]', ...args);
	}

	/**
	 * Log an error from the worker (helpful for debugging)
	 */
	protected logError(...args: any[]): void {
		console.error('[Worker]', ...args);
	}
}
