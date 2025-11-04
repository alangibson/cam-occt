/**
 * JSON-RPC 2.0 message types for WebWorker communication
 */

export interface JsonRpcRequest {
	jsonrpc: '2.0';
	method: string;
	params: any[];
	id: number;
}

export interface JsonRpcSuccessResponse {
	jsonrpc: '2.0';
	result: any;
	id: number;
}

export interface JsonRpcErrorResponse {
	jsonrpc: '2.0';
	error: {
		code: number;
		message: string;
		data?: any;
	};
	id: number;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * Error codes following JSON-RPC 2.0 specification
 */
export enum JsonRpcErrorCode {
	ParseError = -32700,
	InvalidRequest = -32600,
	MethodNotFound = -32601,
	InvalidParams = -32602,
	InternalError = -32603
}

/**
 * Extract async method names from a type
 */
export type AsyncMethods<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never;
}[keyof T];

/**
 * Extract parameter types from a method
 */
export type MethodParams<T, K extends keyof T> = T[K] extends (...args: infer P) => any ? P : never;

/**
 * Extract return type from an async method
 */
export type MethodReturnType<T, K extends keyof T> = T[K] extends (
	...args: any[]
) => Promise<infer R>
	? R
	: never;

/**
 * Cache entry for method call results
 */
export interface CacheEntry {
	params: any[];
	result: any;
	timestamp: number;
}

/**
 * WebWorker communication error
 */
export class WebWorkerError extends Error {
	constructor(
		message: string,
		public code: JsonRpcErrorCode = JsonRpcErrorCode.InternalError,
		public data?: any
	) {
		super(message);
		this.name = 'WebWorkerError';
	}
}
