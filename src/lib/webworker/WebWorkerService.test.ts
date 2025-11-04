/**
 * Tests for WebWorkerService base class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebWorkerService } from './WebWorkerService.js';
import { JsonRpcErrorCode } from './types.js';
import type { JsonRpcRequest, JsonRpcResponse } from './types.js';

// Mock service interface
interface TestService {
	add(a: number, b: number): Promise<number>;
	echo(message: string): Promise<string>;
	throwError(): Promise<void>;
}

// Test service implementation
class TestServiceImpl extends WebWorkerService<TestService> implements TestService {
	async add(a: number, b: number): Promise<number> {
		return a + b;
	}

	async echo(message: string): Promise<string> {
		return message;
	}

	async throwError(): Promise<void> {
		throw new Error('Intentional error');
	}
}

describe('WebWorkerService', () => {
	let service: TestServiceImpl;
	let mockPostMessage: ReturnType<typeof vi.fn>;
	let originalSelf: typeof globalThis;

	beforeEach(() => {
		// Mock the self object
		mockPostMessage = vi.fn();
		originalSelf = globalThis.self;
		(globalThis as any).self = {
			postMessage: mockPostMessage,
			onmessage: null
		};

		service = new TestServiceImpl();
	});

	afterEach(() => {
		(globalThis as any).self = originalSelf;
	});

	describe('Message handling', () => {
		it('should handle valid JSON-RPC request', async () => {
			const request: JsonRpcRequest = {
				jsonrpc: '2.0',
				method: 'add',
				params: [5, 10],
				id: 1
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			expect(mockPostMessage).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				result: 15,
				id: 1
			});
		});

		it('should handle method with string parameter', async () => {
			const request: JsonRpcRequest = {
				jsonrpc: '2.0',
				method: 'echo',
				params: ['hello world'],
				id: 2
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			expect(mockPostMessage).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				result: 'hello world',
				id: 2
			});
		});
	});

	describe('Error handling', () => {
		it('should send error response for invalid JSON-RPC request', async () => {
			const invalidRequest = {
				// Missing jsonrpc field
				method: 'add',
				params: [1, 2],
				id: 1
			};

			await (globalThis as any).self.onmessage(
				new MessageEvent('message', { data: invalidRequest })
			);

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					jsonrpc: '2.0',
					error: expect.objectContaining({
						code: JsonRpcErrorCode.InvalidRequest,
						message: 'Invalid JSON-RPC request'
					})
				})
			);
		});

		it('should send error response for method not found', async () => {
			const request: JsonRpcRequest = {
				jsonrpc: '2.0',
				method: 'nonexistent',
				params: [],
				id: 1
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			expect(mockPostMessage).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				error: {
					code: JsonRpcErrorCode.MethodNotFound,
					message: "Method 'nonexistent' not found",
					data: { method: 'nonexistent' }
				},
				id: 1
			});
		});

		it('should send error response for invalid params', async () => {
			const request = {
				jsonrpc: '2.0',
				method: 'add',
				params: 'not an array', // Should be array
				id: 1
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			expect(mockPostMessage).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				error: {
					code: JsonRpcErrorCode.InvalidParams,
					message: 'Params must be an array',
					data: { params: 'not an array' }
				},
				id: 1
			});
		});

		it('should send error response when method throws', async () => {
			const request: JsonRpcRequest = {
				jsonrpc: '2.0',
				method: 'throwError',
				params: [],
				id: 1
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			expect(mockPostMessage).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				error: {
					code: JsonRpcErrorCode.InternalError,
					message: 'Intentional error'
				},
				id: 1
			});
		});

		it('should handle request without ID', async () => {
			const invalidRequest = {
				jsonrpc: '2.0',
				method: 'add',
				params: [1, 2]
				// Missing id
			};

			await (globalThis as any).self.onmessage(
				new MessageEvent('message', { data: invalidRequest })
			);

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					jsonrpc: '2.0',
					error: expect.any(Object),
					id: -1 // Should use -1 for missing ID
				})
			);
		});
	});

	describe('JSON-RPC response format', () => {
		it('should send success response with correct format', async () => {
			const request: JsonRpcRequest = {
				jsonrpc: '2.0',
				method: 'add',
				params: [100, 200],
				id: 42
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			const response = mockPostMessage.mock.calls[0][0];
			expect(response).toEqual({
				jsonrpc: '2.0',
				result: 300,
				id: 42
			});
		});

		it('should send error response with correct format', async () => {
			const request: JsonRpcRequest = {
				jsonrpc: '2.0',
				method: 'throwError',
				params: [],
				id: 99
			};

			await (globalThis as any).self.onmessage(new MessageEvent('message', { data: request }));

			const response = mockPostMessage.mock.calls[0][0];
			expect(response).toMatchObject({
				jsonrpc: '2.0',
				error: {
					code: expect.any(Number),
					message: expect.any(String)
				},
				id: 99
			});
		});
	});

	describe('Logging helpers', () => {
		it('should provide log method for debugging', () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			(service as any).log('test message', 123);

			expect(consoleSpy).toHaveBeenCalledWith('[Worker]', 'test message', 123);

			consoleSpy.mockRestore();
		});

		it('should provide logError method for debugging', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			(service as any).logError('error message', { code: 500 });

			expect(consoleSpy).toHaveBeenCalledWith('[Worker]', 'error message', { code: 500 });

			consoleSpy.mockRestore();
		});
	});
});
