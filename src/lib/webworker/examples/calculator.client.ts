/**
 * Example WebWorker client implementations
 *
 * Two approaches:
 * 1. Direct Comlink wrapping (simplest, no boilerplate)
 * 2. WebWorkerClient base class (adds caching and error handling)
 */

import * as Comlink from 'comlink';
import { WebWorkerClient } from '../WebWorkerClient.js';
import type { CalculatorService } from './calculator.service.js';

/**
 * Approach 1: Direct Comlink wrapping (simplest)
 *
 * Usage with vite-plugin-comlink:
 * ```ts
 * import ComlinkWorker from './calculator.worker?worker&comlink';
 * const calc = await new ComlinkWorker<CalculatorService>();
 * const result = await calc.add(2, 3);
 * calc[Comlink.releaseProxy]();
 * ```
 *
 * Or manually:
 * ```ts
 * const worker = new Worker(new URL('./calculator.worker.ts', import.meta.url), { type: 'module' });
 * const calc = Comlink.wrap<CalculatorService>(worker);
 * const result = await calc.add(2, 3);
 * calc[Comlink.releaseProxy]();
 * worker.terminate();
 * ```
 */

/**
 * Approach 2: WebWorkerClient base class (adds caching and lifecycle management)
 *
 * Usage:
 * ```ts
 * const worker = new Worker(new URL('./calculator.worker.ts', import.meta.url), { type: 'module' });
 * const calc = new CalculatorClient(worker);
 * const result1 = await calc.add(2, 3);  // Calls worker
 * const result2 = await calc.add(2, 3);  // Returns cached result
 * calc.dispose();
 * ```
 */
export class CalculatorClient extends WebWorkerClient<CalculatorService> implements CalculatorService {
	async add(a: number, b: number): Promise<number> {
		return this.call('add', a, b);
	}

	async subtract(a: number, b: number): Promise<number> {
		return this.call('subtract', a, b);
	}

	async multiply(a: number, b: number): Promise<number> {
		return this.call('multiply', a, b);
	}

	async divide(a: number, b: number): Promise<number> {
		return this.call('divide', a, b);
	}

	async factorial(n: number): Promise<number> {
		return this.call('factorial', n);
	}

	async fibonacci(n: number): Promise<number> {
		return this.call('fibonacci', n);
	}
}
