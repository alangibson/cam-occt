import { describe, it, expect } from 'vitest';
import { hashObject } from './functions';

describe('hashObject', () => {
    it('should produce same hash for identical objects', async () => {
        const obj1 = { x: 1, y: 2 };
        const obj2 = { x: 1, y: 2 };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should produce same hash regardless of property order', async () => {
        const obj1 = { x: 1, y: 2, z: 3 };
        const obj2 = { z: 3, x: 1, y: 2 };
        const obj3 = { y: 2, z: 3, x: 1 };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);
        const hash3 = await hashObject(obj3);

        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
    });

    it('should produce different hashes for different objects', async () => {
        const obj1 = { x: 1, y: 2 };
        const obj2 = { x: 1, y: 3 };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects', async () => {
        const obj1 = {
            center: { x: 1, y: 2 },
            radius: 5,
        };
        const obj2 = {
            radius: 5,
            center: { y: 2, x: 1 },
        };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should handle arrays', async () => {
        const obj1 = {
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
        };
        const obj2 = {
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
        };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different array contents', async () => {
        const obj1 = {
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
        };
        const obj2 = {
            points: [
                { x: 1, y: 2 },
                { x: 5, y: 6 },
            ],
        };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different array order', async () => {
        const obj1 = {
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
        };
        const obj2 = {
            points: [
                { x: 3, y: 4 },
                { x: 1, y: 2 },
            ],
        };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).not.toBe(hash2);
    });

    it('should handle optional properties consistently', async () => {
        const obj1 = { x: 1, y: 2 };
        const obj2 = { x: 1, y: 2, z: undefined };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        // JSON.stringify omits undefined values, so these should be the same
        expect(hash1).toBe(hash2);
    });

    it('should handle empty objects', async () => {
        const obj1 = {};
        const obj2 = {};

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should handle empty arrays', async () => {
        const obj1 = { items: [] };
        const obj2 = { items: [] };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should handle boolean values', async () => {
        const obj1 = { clockwise: true, closed: false };
        const obj2 = { closed: false, clockwise: true };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different boolean values', async () => {
        const obj1 = { clockwise: true };
        const obj2 = { clockwise: false };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).not.toBe(hash2);
    });

    it('should handle null values', async () => {
        const obj1 = { value: null };
        const obj2 = { value: null };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should produce hex string of correct length', async () => {
        const obj = { x: 1, y: 2 };
        const hash = await hashObject(obj);

        // SHA-256 produces 256 bits = 64 hex characters
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle deeply nested objects', async () => {
        const obj1 = {
            a: {
                b: {
                    c: {
                        d: 1,
                    },
                },
            },
        };
        const obj2 = {
            a: {
                b: {
                    c: {
                        d: 1,
                    },
                },
            },
        };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).toBe(hash2);
    });

    it('should handle numbers with different precision', async () => {
        const obj1 = { value: 1.0 };
        const obj2 = { value: 1 };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        // 1.0 and 1 are the same in JSON
        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different numeric precision', async () => {
        const obj1 = { value: 1.1 };
        const obj2 = { value: 1.10000001 };

        const hash1 = await hashObject(obj1);
        const hash2 = await hashObject(obj2);

        expect(hash1).not.toBe(hash2);
    });
});
