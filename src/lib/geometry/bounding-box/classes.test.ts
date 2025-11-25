import { describe, it, expect } from 'vitest';
import { BoundingBox } from './classes';
import type { BoundingBoxData } from './interfaces';

describe('BoundingBox', () => {
    describe('overlaps', () => {
        it('should detect overlapping boxes', () => {
            const box1 = new BoundingBox({
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            });
            const box2 = new BoundingBox({
                min: { x: 5, y: 5 },
                max: { x: 15, y: 15 },
            });

            expect(box1.overlaps(box2)).toBe(true);
            expect(box2.overlaps(box1)).toBe(true);
        });

        it('should detect non-overlapping boxes on X axis', () => {
            const box1 = new BoundingBox({
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            });
            const box2 = new BoundingBox({
                min: { x: 20, y: 0 },
                max: { x: 30, y: 10 },
            });

            expect(box1.overlaps(box2)).toBe(false);
            expect(box2.overlaps(box1)).toBe(false);
        });

        it('should detect non-overlapping boxes on Y axis', () => {
            const box1 = new BoundingBox({
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            });
            const box2 = new BoundingBox({
                min: { x: 0, y: 20 },
                max: { x: 10, y: 30 },
            });

            expect(box1.overlaps(box2)).toBe(false);
            expect(box2.overlaps(box1)).toBe(false);
        });

        it('should detect edge-touching boxes as overlapping', () => {
            const box1 = new BoundingBox({
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            });
            const box2 = new BoundingBox({
                min: { x: 10, y: 0 },
                max: { x: 20, y: 10 },
            });

            expect(box1.overlaps(box2)).toBe(true);
            expect(box2.overlaps(box1)).toBe(true);
        });

        it('should detect contained boxes as overlapping', () => {
            const box1 = new BoundingBox({
                min: { x: 0, y: 0 },
                max: { x: 20, y: 20 },
            });
            const box2 = new BoundingBox({
                min: { x: 5, y: 5 },
                max: { x: 15, y: 15 },
            });

            expect(box1.overlaps(box2)).toBe(true);
            expect(box2.overlaps(box1)).toBe(true);
        });
    });

    describe('getters', () => {
        it('should provide access to min and max points', () => {
            const data: BoundingBoxData = {
                min: { x: 1, y: 2 },
                max: { x: 3, y: 4 },
            };
            const box = new BoundingBox(data);

            expect(box.min).toEqual({ x: 1, y: 2 });
            expect(box.max).toEqual({ x: 3, y: 4 });
        });
    });

    describe('toData', () => {
        it('should convert back to plain data object', () => {
            const data: BoundingBoxData = {
                min: { x: 1, y: 2 },
                max: { x: 3, y: 4 },
            };
            const box = new BoundingBox(data);
            const result = box.toData();

            expect(result).toEqual(data);
            // Should be a copy, not the same reference
            expect(result).not.toBe(data);
        });
    });
});
