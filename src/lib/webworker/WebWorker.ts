/**
 * Base class for WebWorkers using Comlink
 *
 * Provides type-safe async method dispatching to WebWorkers using Comlink.
 * Results from the last call are cached automatically.
 * Supports sharing a single worker across multiple class instances.
 *
 * @example
 * // Define service interface
 * interface MathService {
 *   add(a: number, b: number): Promise<number>;
 *   multiply(a: number, b: number): Promise<number>;
 * }
 *
 * // Worker file (math.worker.ts)
 * import { WorkerService } from './WorkerService';
 * class MathServiceImpl extends WorkerService implements MathService {
 *   async add(a: number, b: number) { return a + b; }
 *   async multiply(a: number, b: number) { return a * b; }
 * }
 * WorkerService.expose(new MathServiceImpl());
 *
 * // Single worker usage
 * const worker = new Worker(new URL('./math.worker.ts', import.meta.url), { type: 'module' });
 * const math = new Math(worker);
 * const result = await math.add(2, 3); // 5
 * math.dispose();
 *
 * // Shared worker usage - multiple classes use the same worker
 * const worker = new Worker(new URL('./math.worker.ts', import.meta.url), { type: 'module' });
 * const wrapped = Comlink.wrap<MathService>(worker);
 * const math1 = new Math(wrapped);  // Each has independent cache
 * const math2 = new Math(wrapped);  // Shares the same worker
 * // Disposing math1 won't terminate the worker since it's shared
 */

import * as Comlink from 'comlink';
import type { CacheEntry, WebWorkerOptions } from './types.js';
import { WebWorkerError } from './types.js';

export abstract class WebWorker<TService> {
	protected readonly worker: Worker | null;
	protected readonly wrapped: Comlink.Remote<TService>;
	private lastCallCache = new Map<string, CacheEntry>();
	private disposed = false;
	private enableCache: boolean;
	private ownsWorker: boolean;

	static readonly dispose = Symbol('dispose');

	/**
	 * Create a new WebWorker
	 * @param workerOrWrapped - Either a Worker instance or an already-wrapped Comlink.Remote
	 * @param options - Optional configuration
	 */
	constructor(workerOrWrapped: Worker | Comlink.Remote<TService>, options: WebWorkerOptions = {}) {
		this.enableCache = options.enableCache ?? true;

		// Determine if we received a Worker or a wrapped Remote
		const isWorker = typeof Worker !== "undefined" && workerOrWrapped instanceof Worker; if (isWorker) {
			// We own this worker - wrap it and manage its lifecycle
			this.worker = workerOrWrapped;
			this.wrapped = Comlink.wrap<TService>(workerOrWrapped);
			this.ownsWorker = true;

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
		} else {
			// Shared worker - we don't own it
			this.worker = null;
			this.wrapped = workerOrWrapped;
			this.ownsWorker = false;
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
			throw new WebWorkerError('Worker has been disposed');
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
	 * Only terminates the worker if this instance owns it (not shared)
	 */
	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.lastCallCache.clear();

		// Clean up Comlink proxy (but don't terminate shared workers)
		if (this.ownsWorker) {
			this.wrapped[Comlink.releaseProxy]();
			// Only terminate if we own the worker
			this.worker!.terminate();
		}
		// For shared workers, just clean up our local state
	}
}
