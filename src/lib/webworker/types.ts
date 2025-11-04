/**
 * Type utilities for WebWorker communication with Comlink
 */

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
export interface CacheEntry<T = any> {
	params: any[];
	result: T;
	timestamp: number;
}

/**
 * WebWorker communication error
 */
export class WebWorkerError extends Error {
	constructor(
		message: string,
		public data?: any
	) {
		super(message);
		this.name = 'WebWorkerError';
	}
}

/**
 * Options for creating a WebWorker client
 */
export interface WebWorkerClientOptions {
	/**
	 * Enable caching of the last method call result
	 * @default true
	 */
	enableCache?: boolean;

	/**
	 * Custom error handler for worker errors
	 */
	onError?: (error: Error) => void;
}
