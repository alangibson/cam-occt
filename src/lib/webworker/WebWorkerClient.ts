/**
 * Base class for WebWorker clients using Comlink
 *
 * Provides type-safe async method dispatching to WebWorkers using Comlink.
 * Results from the last call are cached automatically.
 *
 * @example
 * // Define service interface
 * interface MathService {
 *   add(a: number, b: number): Promise<number>;
 *   multiply(a: number, b: number): Promise<number>;
 * }
 *
 * // Worker file (math.worker.ts)
 * import { WebWorkerService } from './WebWorkerService';
 * class MathServiceImpl extends WebWorkerService implements MathService {
 *   async add(a: number, b: number) { return a + b; }
 *   async multiply(a: number, b: number) { return a * b; }
 * }
 * WebWorkerService.expose(new MathServiceImpl());
 *
 * // Client usage
 * import ComlinkWorker from './math.worker?worker&comlink';
 * const math = await new ComlinkWorker<MathService>();
 * const result = await math.add(2, 3); // 5
 * math[WebWorkerClient.dispose]();
 */

import * as Comlink from 'comlink';
import type { CacheEntry, WebWorkerClientOptions } from './types.js';
import { WebWorkerError } from './types.js';

export abstract class WebWorkerClient<TService> {
	protected readonly worker: Worker;
	protected readonly wrapped: Comlink.Remote<TService>;
	private lastCallCache = new Map<string, CacheEntry>();
	private disposed = false;
	private enableCache: boolean;

	static readonly dispose = Symbol('dispose');

	/**
	 * Create a new WebWorker client
	 * @param worker - The Worker instance to communicate with
	 * @param options - Optional configuration
	 */
	constructor(worker: Worker, options: WebWorkerClientOptions = {}) {
		this.worker = worker;
		this.enableCache = options.enableCache ?? true;
		this.wrapped = Comlink.wrap<TService>(worker);

		// Set up error handler
		if (options.onError) {
			this.worker.onerror = (event: ErrorEvent) => {
				options.onError!(
					new WebWorkerError(`Worker error: ${event.message}`, {
						filename: event.filename,
						lineno: event.lineno,
						colno: event.colno
					})
				);
			};
		}
	}

	/**
	 * Call a method on the worker service with caching
	 * @param method - The method name to call
	 * @param params - The parameters to pass to the method
	 * @returns Promise that resolves with the method's return value
	 * @throws {WebWorkerError} If communication fails or method execution fails
	 */
	protected async call<K extends keyof TService>(method: K, ...params: any[]): Promise<any> {
		if (this.disposed) {
			throw new WebWorkerError('Worker client has been disposed');
		}

		// Check cache for last call with same method and params
		if (this.enableCache) {
			const cacheKey = this.getCacheKey(String(method), params);
			const cached = this.lastCallCache.get(cacheKey);
			if (cached) {
				return cached.result;
			}
		}

		try {
			// Call the wrapped method
			const wrappedMethod = this.wrapped[method] as any;
			const result = await wrappedMethod(...params);

			// Cache the result
			if (this.enableCache) {
				const cacheKey = this.getCacheKey(String(method), params);
				this.lastCallCache.clear(); // Only keep last call
				this.lastCallCache.set(cacheKey, {
					params,
					result,
					timestamp: Date.now()
				});
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new WebWorkerError(`Worker method call failed: ${errorMessage}`, error);
		}
	}

	/**
	 * Generate a cache key from method name and parameters
	 */
	private getCacheKey(method: string, params: any[]): string {
		return `${method}:${JSON.stringify(params)}`;
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
		this.lastCallCache.clear();

		// Clean up Comlink proxy
		this.wrapped[Comlink.releaseProxy]();

		// Terminate the worker
		this.worker.terminate();
	}
}
