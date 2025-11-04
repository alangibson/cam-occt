/**
 * Example WebWorker implementation with caching
 *
 * Usage:
 * ```ts
 * const worker = new Worker(new URL('./calculator.worker.ts', import.meta.url), { type: 'module' });
 * const calc = new Calculator(worker);
 * const result1 = await calc.add(2, 3);  // Calls worker
 * const result2 = await calc.add(2, 3);  // Returns cached result
 * calc.dispose();
 * ```
 */

import { WebWorker } from '../WebWorker.js';
import type { CalculatorService } from './calculator.service.js';

export class Calculator extends WebWorker<CalculatorService> implements CalculatorService {
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
