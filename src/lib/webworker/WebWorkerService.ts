/**
 * Base class for WebWorker services using Comlink
 *
 * Provides helper methods for worker services.
 * Use WebWorkerService.expose() to expose your service to the main thread.
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
 * class MathServiceImpl extends WebWorkerService implements MathService {
 *   async add(a: number, b: number): Promise<number> {
 *     this.log('add', a, b);
 *     return a + b;
 *   }
 *
 *   async multiply(a: number, b: number): Promise<number> {
 *     this.log('multiply', a, b);
 *     return a * b;
 *   }
 * }
 *
 * // Expose the service using Comlink
 * WebWorkerService.expose(new MathServiceImpl());
 */

import * as Comlink from 'comlink';

export abstract class WebWorkerService {
	/**
	 * Expose a service instance to the main thread using Comlink
	 * @param instance - The service instance to expose
	 */
	static expose<T extends object>(instance: T): void {
		Comlink.expose(instance);
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
