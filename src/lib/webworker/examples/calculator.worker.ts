/**
 * Example WebWorker service implementation using Comlink
 * This demonstrates how to create a worker service using WorkerService base class
 */

import { WorkerService } from '../WorkerService.js';
import type { CalculatorService } from './calculator.service.js';

class CalculatorServiceImpl extends WorkerService implements CalculatorService {
	async add(a: number, b: number): Promise<number> {
		this.log('add', a, b);
		return a + b;
	}

	async subtract(a: number, b: number): Promise<number> {
		this.log('subtract', a, b);
		return a - b;
	}

	async multiply(a: number, b: number): Promise<number> {
		this.log('multiply', a, b);
		return a * b;
	}

	async divide(a: number, b: number): Promise<number> {
		this.log('divide', a, b);
		if (b === 0) {
			throw new Error('Division by zero');
		}
		return a / b;
	}

	async factorial(n: number): Promise<number> {
		this.log('factorial', n);
		if (n < 0) {
			throw new Error('Factorial is not defined for negative numbers');
		}
		if (n === 0 || n === 1) {
			return 1;
		}
		let result = 1;
		for (let i = 2; i <= n; i++) {
			result *= i;
		}
		return result;
	}

	async fibonacci(n: number): Promise<number> {
		this.log('fibonacci', n);
		if (n < 0) {
			throw new Error('Fibonacci is not defined for negative numbers');
		}
		if (n === 0) return 0;
		if (n === 1) return 1;

		let prev = 0;
		let curr = 1;
		for (let i = 2; i <= n; i++) {
			const next = prev + curr;
			prev = curr;
			curr = next;
		}
		return curr;
	}
}

// Expose the service using Comlink
WorkerService.expose(new CalculatorServiceImpl());
