/**
 * Example WebWorker client implementation
 * This demonstrates how to create a client using WebWorkerClient base class
 */

import { WebWorkerClient } from '../WebWorkerClient.js';
import type { CalculatorService } from './calculator.service.js';

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
