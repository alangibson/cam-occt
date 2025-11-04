/**
 * Example: Sharing a single worker across multiple classes
 *
 * This demonstrates how multiple classes can use the same expensive worker,
 * each with independent caching.
 */

import * as Comlink from 'comlink';
import { WebWorker } from '../WebWorker.js';

// Define service interfaces
interface MathService {
	add(a: number, b: number): Promise<number>;
	multiply(a: number, b: number): Promise<number>;
	factorial(n: number): Promise<number>;
}

// Main thread classes - each extends WebWorker with independent cache
class MathCalculator extends WebWorker<MathService> implements MathService {
	async add(a: number, b: number): Promise<number> {
		return this.call('add', a, b);
	}

	async multiply(a: number, b: number): Promise<number> {
		return this.call('multiply', a, b);
	}

	async factorial(n: number): Promise<number> {
		return this.call('factorial', n);
	}
}

class AdvancedMath extends WebWorker<MathService> implements MathService {
	async add(a: number, b: number): Promise<number> {
		return this.call('add', a, b);
	}

	async multiply(a: number, b: number): Promise<number> {
		return this.call('multiply', a, b);
	}

	async factorial(n: number): Promise<number> {
		return this.call('factorial', n);
	}

	// Additional methods specific to this class
	async square(n: number): Promise<number> {
		return this.multiply(n, n);
	}
}

// Usage Example 1: Each class creates its own worker (not shared)
export async function separateWorkersExample() {
	const worker1 = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
		type: 'module'
	});
	const worker2 = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
		type: 'module'
	});

	const calc1 = new MathCalculator(worker1);
	const calc2 = new AdvancedMath(worker2);

	const result1 = await calc1.add(2, 3); // Uses worker1
	const result2 = await calc2.add(2, 3); // Uses worker2 (separate worker)

	// Clean up - each terminates its own worker
	calc1.dispose();
	calc2.dispose();
}

// Usage Example 2: Multiple classes share the same worker
export async function sharedWorkerExample() {
	// Create one worker instance
	const worker = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
		type: 'module'
	});

	// Wrap it once with Comlink
	const wrapped = Comlink.wrap<MathService>(worker);

	// Multiple classes use the same wrapped worker
	const calc1 = new MathCalculator(wrapped);
	const calc2 = new AdvancedMath(wrapped);

	// Each has independent cache
	const result1 = await calc1.add(2, 3); // Calls worker, caches result in calc1
	const result2 = await calc2.add(2, 3); // Calls worker again, caches in calc2
	const result3 = await calc1.add(2, 3); // Returns from calc1's cache (no worker call)
	const result4 = await calc2.add(2, 3); // Returns from calc2's cache (no worker call)

	console.log({ result1, result2, result3, result4 }); // All are 5

	// Clean up - disposing doesn't terminate shared worker
	calc1.dispose();
	calc2.dispose();

	// Manually terminate the shared worker when done
	wrapped[Comlink.releaseProxy]();
	worker.terminate();
}

// Usage Example 3: Mix of owned and shared workers
export async function mixedExample() {
	// Create one expensive worker to share
	const sharedWorker = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
		type: 'module'
	});
	const wrapped = Comlink.wrap<MathService>(sharedWorker);

	// First class owns its own worker
	const ownedWorker = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
		type: 'module'
	});
	const calc1 = new MathCalculator(ownedWorker); // Owns worker

	// Other classes share the expensive worker
	const calc2 = new AdvancedMath(wrapped); // Shared
	const calc3 = new MathCalculator(wrapped); // Shared

	await calc1.add(1, 2); // Uses its own worker
	await calc2.add(3, 4); // Uses shared worker
	await calc3.add(5, 6); // Uses shared worker

	// Disposing calc1 terminates its worker
	calc1.dispose(); // Worker terminated

	// Disposing calc2/calc3 doesn't terminate shared worker
	calc2.dispose();
	calc3.dispose();

	// Clean up shared worker
	wrapped[Comlink.releaseProxy]();
	sharedWorker.terminate();
}

// Usage Example 4: Singleton pattern for expensive worker
class ExpensiveWorkerManager {
	private static instance: Comlink.Remote<MathService> | null = null;
	private static worker: Worker | null = null;
	private static refCount = 0;

	static async getInstance(): Promise<Comlink.Remote<MathService>> {
		if (!this.instance) {
			this.worker = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
				type: 'module'
			});
			this.instance = Comlink.wrap<MathService>(this.worker);
		}
		this.refCount++;
		return this.instance;
	}

	static release(): void {
		this.refCount--;
		if (this.refCount === 0 && this.instance && this.worker) {
			this.instance[Comlink.releaseProxy]();
			this.worker.terminate();
			this.instance = null;
			this.worker = null;
		}
	}
}

export async function singletonExample() {
	// All classes automatically share the singleton worker
	const wrapped1 = await ExpensiveWorkerManager.getInstance();
	const wrapped2 = await ExpensiveWorkerManager.getInstance();

	const calc1 = new MathCalculator(wrapped1);
	const calc2 = new AdvancedMath(wrapped2);

	await calc1.add(10, 20);
	await calc2.multiply(5, 6);

	// Release references - worker terminates when count reaches 0
	calc1.dispose();
	ExpensiveWorkerManager.release();

	calc2.dispose();
	ExpensiveWorkerManager.release(); // Worker terminated here
}
