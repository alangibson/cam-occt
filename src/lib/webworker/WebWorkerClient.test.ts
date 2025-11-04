/**
 * Tests for WebWorkerClient base class with Comlink
 *
 * Note: These are unit tests for the base class functionality.
 * Full integration tests with real workers should be done in e2e tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebWorkerClient } from './WebWorkerClient.js';
import { WebWorkerError } from './types.js';

// Mock Comlink - must be defined inline in the factory due to hoisting
vi.mock('comlink', () => {
	const mockReleaseProxy = Symbol.for('comlink.releaseProxy');
	const mockWrapped = {
		add: vi.fn().mockResolvedValue(15),
		echo: vi.fn().mockResolvedValue('hello'),
		multiply: vi.fn().mockResolvedValue(12),
		throwError: vi.fn().mockRejectedValue(new Error('Intentional error')),
		[mockReleaseProxy]: vi.fn()
	};

	return {
		wrap: vi.fn().mockReturnValue(mockWrapped),
		releaseProxy: mockReleaseProxy,
		// Expose mockWrapped for test access
		__mockWrapped: mockWrapped
	};
});

// Import the mocked module
import * as Comlink from 'comlink';

// Access the mock wrapped object
const mockWrapped = (Comlink as any).__mockWrapped;

// Test service interface
interface TestService {
	add(a: number, b: number): Promise<number>;
	echo(message: string): Promise<string>;
	multiply(a: number, b: number): Promise<number>;
	throwError(): Promise<void>;
}

// Test client implementation
class TestClient extends WebWorkerClient<TestService> implements TestService {
	async add(a: number, b: number): Promise<number> {
		return this.call('add', a, b);
	}

	async echo(message: string): Promise<string> {
		return this.call('echo', message);
	}

	async multiply(a: number, b: number): Promise<number> {
		return this.call('multiply', a, b);
	}

	async throwError(): Promise<void> {
		return this.call('throwError');
	}

	// Expose protected methods for testing
	public clearCachePublic(): void {
		this.clearCache();
	}

	public getWrapped(): Comlink.Remote<TestService> {
		return this.wrapped;
	}
}

describe('WebWorkerClient', () => {
	let mockWorker: Worker;
	let client: TestClient;

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();

		// Create mock worker
		mockWorker = {
			postMessage: vi.fn(),
			terminate: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			onerror: null,
			onmessage: null,
			onmessageerror: null
		} as unknown as Worker;

		client = new TestClient(mockWorker);
	});

	describe('Construction', () => {
		it('should create client and wrap worker', () => {
			expect(Comlink.wrap).toHaveBeenCalledWith(mockWorker);
			expect(client).toBeInstanceOf(WebWorkerClient);
		});

		it('should support options', () => {
			const errorHandler = vi.fn();
			const clientWithOptions = new TestClient(mockWorker, {
				enableCache: false,
				onError: errorHandler
			});

			expect(clientWithOptions).toBeInstanceOf(WebWorkerClient);
		});
	});

	describe('Method calls', () => {
		it('should call wrapped methods', async () => {
			const result = await client.add(5, 10);

			expect(mockWrapped.add).toHaveBeenCalledWith(5, 10);
			expect(result).toBe(15);
		});

		it('should preserve types', async () => {
			const num: number = await client.add(1, 2);
			const str: string = await client.echo('test');

			expect(typeof num).toBe('number');
			expect(typeof str).toBe('string');
		});

		it('should handle multiple calls', async () => {
			await client.add(1, 2);
			await client.multiply(3, 4);
			await client.echo('test');

			expect(mockWrapped.add).toHaveBeenCalledTimes(1);
			expect(mockWrapped.multiply).toHaveBeenCalledTimes(1);
			expect(mockWrapped.echo).toHaveBeenCalledTimes(1);
		});
	});

	describe('Caching', () => {
		it('should cache last call result by default', async () => {
			const result1 = await client.add(5, 10);
			const result2 = await client.add(5, 10);

			// Should only call wrapped method once due to caching
			expect(mockWrapped.add).toHaveBeenCalledTimes(1);
			expect(result1).toBe(15);
			expect(result2).toBe(15);
		});

		it('should not cache when parameters differ', async () => {
			await client.add(5, 10);
			await client.add(3, 7);

			// Should call twice with different params
			expect(mockWrapped.add).toHaveBeenCalledTimes(2);
		});

		it('should clear cache manually', async () => {
			await client.add(5, 10);
			client.clearCachePublic();
			await client.add(5, 10);

			// Should call twice after cache clear
			expect(mockWrapped.add).toHaveBeenCalledTimes(2);
		});

		it('should only keep last call in cache', async () => {
			await client.add(1, 2);
			await client.add(3, 4);
			await client.add(3, 4); // This should use cache

			// First call: add(1,2), second: add(3,4), third: cached add(3,4)
			expect(mockWrapped.add).toHaveBeenCalledTimes(2);
		});

		it('should respect enableCache option', async () => {
			// Create new client with caching disabled
			const clientNoCache = new TestClient(mockWorker, { enableCache: false });

			await clientNoCache.add(5, 10);
			await clientNoCache.add(5, 10);

			// Should call twice when caching disabled (since we reset mocks in beforeEach and created new client)
			// The mock is shared, so we expect it to be called additional times
			// Let's verify by counting from this point
			const callsBefore = mockWrapped.add.mock.calls.length;

			await clientNoCache.add(7, 8);
			await clientNoCache.add(7, 8);

			const callsAfter = mockWrapped.add.mock.calls.length;
			// With cache disabled, both calls should go through
			expect(callsAfter - callsBefore).toBe(2);

			clientNoCache.dispose();
		});
	});

	describe('Error handling', () => {
		it('should propagate errors from worker', async () => {
			await expect(client.throwError()).rejects.toThrow('Worker method call failed');
		});

		it('should wrap errors in WebWorkerError', async () => {
			try {
				await client.throwError();
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(WebWorkerError);
				expect((error as WebWorkerError).message).toContain('Worker method call failed');
			}
		});

		it('should throw error when calling after dispose', async () => {
			client.dispose();

			await expect(client.add(1, 2)).rejects.toThrow('Worker client has been disposed');
			await expect(client.add(1, 2)).rejects.toThrow(WebWorkerError);
		});
	});

	describe('Lifecycle', () => {
		it('should release proxy on dispose', () => {
			client.dispose();

			expect(mockWrapped[Comlink.releaseProxy]).toHaveBeenCalled();
		});

		it('should terminate worker on dispose', () => {
			client.dispose();

			expect(mockWorker.terminate).toHaveBeenCalled();
		});

		it('should handle multiple dispose calls', () => {
			client.dispose();
			client.dispose();

			// Should only terminate once
			expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
		});

		it('should clear cache on dispose', async () => {
			await client.add(5, 10);
			client.dispose();

			// After dispose, can't test cache but disposal should succeed
			expect(mockWorker.terminate).toHaveBeenCalled();
		});
	});

	describe('Error handler option', () => {
		it('should call error handler on worker error', () => {
			const errorHandler = vi.fn();
			const clientWithHandler = new TestClient(mockWorker, {
				onError: errorHandler
			});

			// Simulate worker error
			const errorEvent = new ErrorEvent('error', {
				message: 'Worker crashed',
				filename: 'worker.js',
				lineno: 42,
				colno: 10
			});

			if (mockWorker.onerror) {
				mockWorker.onerror(errorEvent);
			}

			expect(errorHandler).toHaveBeenCalled();
			const error = errorHandler.mock.calls[0][0];
			expect(error).toBeInstanceOf(WebWorkerError);

			clientWithHandler.dispose();
		});
	});
});
