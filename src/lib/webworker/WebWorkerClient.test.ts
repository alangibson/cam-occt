/**
 * Tests for WebWorkerClient base class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebWorkerClient } from './WebWorkerClient.js';
import { JsonRpcErrorCode, WebWorkerError } from './types.js';
import type { JsonRpcRequest, JsonRpcResponse } from './types.js';

// Mock service interface
interface TestService {
	add(a: number, b: number): Promise<number>;
	echo(message: string): Promise<string>;
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

	async throwError(): Promise<void> {
		return this.call('throwError');
	}

	// Expose protected methods for testing
	public getPendingCountPublic(): number {
		return this.getPendingCount();
	}

	public clearCachePublic(): void {
		this.clearCache();
	}
}

describe('WebWorkerClient', () => {
	let mockWorker: Worker;
	let client: TestClient;
	let messageHandlers: ((event: MessageEvent) => void)[] = [];
	let errorHandlers: ((event: ErrorEvent) => void)[] = [];
	let messageErrorHandlers: ((event: MessageEvent) => void)[] = [];

	beforeEach(() => {
		messageHandlers = [];
		errorHandlers = [];
		messageErrorHandlers = [];

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

		// Capture event handlers
		if (mockWorker.onmessage) {
			messageHandlers.push(mockWorker.onmessage as any);
		}
		if (mockWorker.onerror) {
			errorHandlers.push(mockWorker.onerror as any);
		}
		if (mockWorker.onmessageerror) {
			messageErrorHandlers.push(mockWorker.onmessageerror as any);
		}
	});

	afterEach(() => {
		client.dispose();
	});

	describe('JSON-RPC message format', () => {
		it('should send JSON-RPC 2.0 formatted request', async () => {
			const promise = client.add(2, 3);

			expect(mockWorker.postMessage).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				method: 'add',
				params: [2, 3],
				id: 1
			});

			// Simulate response
			const request = (mockWorker.postMessage as any).mock.calls[0][0];
			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: {
							jsonrpc: '2.0',
							result: 5,
							id: request.id
						}
					})
				);
			}

			await expect(promise).resolves.toBe(5);
		});

		it('should increment request IDs sequentially', async () => {
			const promise1 = client.add(1, 2);
			const promise2 = client.add(3, 4);

			const calls = (mockWorker.postMessage as any).mock.calls;
			expect(calls[0][0].id).toBe(1);
			expect(calls[1][0].id).toBe(2);

			// Respond to requests
			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 3, id: 1 }
					})
				);
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 7, id: 2 }
					})
				);
			}

			await expect(promise1).resolves.toBe(3);
			await expect(promise2).resolves.toBe(7);
		});
	});

	describe('Type safety', () => {
		it('should preserve method parameter types', async () => {
			const promise = client.add(10, 20);

			// TypeScript compilation ensures type safety
			// This test verifies the call goes through correctly
			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 30, id: 1 }
					})
				);
			}

			await expect(promise).resolves.toBe(30);
		});

		it('should preserve return types', async () => {
			const promise = client.echo('hello');

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 'hello', id: 1 }
					})
				);
			}

			const result = await promise;
			// TypeScript ensures result is string
			expect(typeof result).toBe('string');
			expect(result).toBe('hello');
		});
	});

	describe('Caching', () => {
		it('should cache result of last call', async () => {
			const promise1 = client.add(5, 10);

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 15, id: 1 }
					})
				);
			}

			await promise1;

			// Make the same call again
			const promise2 = client.add(5, 10);

			// Should return cached result without posting message
			expect((mockWorker.postMessage as any).mock.calls.length).toBe(1);
			await expect(promise2).resolves.toBe(15);
		});

		it('should clear cache when different parameters used', async () => {
			const promise1 = client.add(5, 10);

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 15, id: 1 }
					})
				);
			}

			await promise1;

			// Make call with different parameters
			const promise2 = client.add(3, 7);

			// Should post a new message
			expect((mockWorker.postMessage as any).mock.calls.length).toBe(2);

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 10, id: 2 }
					})
				);
			}

			await expect(promise2).resolves.toBe(10);
		});

		it('should allow manual cache clearing', async () => {
			const promise1 = client.add(5, 10);

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 15, id: 1 }
					})
				);
			}

			await promise1;

			// Clear cache
			client.clearCachePublic();

			// Same call should post new message
			const promise2 = client.add(5, 10);
			expect((mockWorker.postMessage as any).mock.calls.length).toBe(2);

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 15, id: 2 }
					})
				);
			}

			await promise2;
		});
	});

	describe('Error handling', () => {
		it('should throw WebWorkerError on JSON-RPC error response', async () => {
			const promise = client.throwError();

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: {
							jsonrpc: '2.0',
							error: {
								code: JsonRpcErrorCode.InternalError,
								message: 'Something went wrong'
							},
							id: 1
						}
					})
				);
			}

			await expect(promise).rejects.toThrow(WebWorkerError);
			await expect(promise).rejects.toThrow('Something went wrong');
		});

		it('should throw error on postMessage failure', async () => {
			(mockWorker.postMessage as any).mockImplementation(() => {
				throw new Error('postMessage failed');
			});

			await expect(client.add(1, 2)).rejects.toThrow(
				'Failed to send message to worker: postMessage failed'
			);
		});

		it('should reject all pending requests on worker error', async () => {
			const promise1 = client.add(1, 2);
			const promise2 = client.add(3, 4);

			// Simulate worker error
			if (mockWorker.onerror) {
				const errorEvent = new ErrorEvent('error', {
					message: 'Worker crashed',
					filename: 'worker.js',
					lineno: 42,
					colno: 10
				});
				mockWorker.onerror(errorEvent);
			}

			await expect(promise1).rejects.toThrow('Worker error: Worker crashed');
			await expect(promise2).rejects.toThrow('Worker error: Worker crashed');
		});

		it('should reject all pending requests on message deserialization error', async () => {
			const promise = client.add(1, 2);

			// Simulate message error
			if (mockWorker.onmessageerror) {
				mockWorker.onmessageerror(
					new MessageEvent('messageerror', {
						data: 'invalid data'
					})
				);
			}

			await expect(promise).rejects.toThrow('Failed to deserialize message from worker');
		});

		it('should throw error when calling after dispose', async () => {
			client.dispose();

			await expect(client.add(1, 2)).rejects.toThrow('Worker client has been disposed');
		});
	});

	describe('Dispose', () => {
		it('should terminate worker on dispose', () => {
			client.dispose();

			expect(mockWorker.terminate).toHaveBeenCalled();
		});

		it('should reject pending requests on dispose', async () => {
			const promise = client.add(1, 2);

			client.dispose();

			await expect(promise).rejects.toThrow('Worker client disposed');
		});

		it('should handle multiple dispose calls gracefully', () => {
			client.dispose();
			client.dispose();

			expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
		});
	});

	describe('Pending requests tracking', () => {
		it('should track pending requests', () => {
			expect(client.getPendingCountPublic()).toBe(0);

			const promise1 = client.add(1, 2);
			expect(client.getPendingCountPublic()).toBe(1);

			const promise2 = client.add(3, 4);
			expect(client.getPendingCountPublic()).toBe(2);

			// Catch rejections that will occur in afterEach when client is disposed
			promise1.catch(() => {});
			promise2.catch(() => {});
		});

		it('should clear pending count after response', async () => {
			const promise = client.add(1, 2);
			expect(client.getPendingCountPublic()).toBe(1);

			if (mockWorker.onmessage) {
				mockWorker.onmessage(
					new MessageEvent('message', {
						data: { jsonrpc: '2.0', result: 3, id: 1 }
					})
				);
			}

			await promise;
			expect(client.getPendingCountPublic()).toBe(0);
		});
	});
});
