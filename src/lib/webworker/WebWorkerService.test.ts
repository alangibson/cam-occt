/**
 * Tests for WebWorkerService base class with Comlink
 */

import { describe, it, expect } from 'vitest';
import { WebWorkerService } from './WebWorkerService.js';
import * as Comlink from 'comlink';

// Test service interface
interface TestService {
	add(a: number, b: number): Promise<number>;
	echo(message: string): Promise<string>;
}

// Test service implementation
class TestServiceImpl extends WebWorkerService implements TestService {
	async add(a: number, b: number): Promise<number> {
		this.log('add called with', a, b);
		return a + b;
	}

	async echo(message: string): Promise<string> {
		this.log('echo called with', message);
		return message;
	}
}

describe('WebWorkerService', () => {
	describe('Service implementation', () => {
		it('should create service instance', () => {
			const service = new TestServiceImpl();
			expect(service).toBeInstanceOf(WebWorkerService);
			expect(service).toBeInstanceOf(TestServiceImpl);
		});

		it('should implement service methods', async () => {
			const service = new TestServiceImpl();
			expect(await service.add(2, 3)).toBe(5);
			expect(await service.echo('test')).toBe('test');
		});
	});

	describe('Static expose method', () => {
		it('should expose service via Comlink', () => {
			// This test just verifies the static method exists and can be called
			// Actual exposure testing requires a worker context
			expect(WebWorkerService.expose).toBeDefined();
			expect(typeof WebWorkerService.expose).toBe('function');
		});
	});

	describe('Logging helpers', () => {
		it('should provide log method', () => {
			const service = new TestServiceImpl();
			expect((service as any).log).toBeDefined();

			// Test that log doesn't throw
			(service as any).log('test message');
		});

		it('should provide logError method', () => {
			const service = new TestServiceImpl();
			expect((service as any).logError).toBeDefined();

			// Test that logError doesn't throw
			(service as any).logError('error message');
		});
	});
});
