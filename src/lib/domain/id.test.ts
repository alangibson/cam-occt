import { describe, it, expect } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
    it('should generate unique IDs', () => {
        const id1 = generateId();
        const id2 = generateId();

        expect(id1).not.toBe(id2);
    });

    it('should generate IDs with the correct format', () => {
        const id = generateId();

        expect(id).toMatch(/^shape_\d+_\d+$/);
    });
});
