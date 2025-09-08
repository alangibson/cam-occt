import { describe, it, expect } from 'vitest';
import { samplePathAtDistanceIntervals } from './index';
import type { Shape, Line } from '../types';

describe('samplePathAtDistanceIntervals', () => {
    describe('Cut Direction Handling', () => {
        it('should produce correct direction vectors in natural shape direction', () => {
            // Create a simple horizontal line from (0,0) to (10,0)
            const line: Shape = {
                id: 'line1',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = samplePathAtDistanceIntervals(shapes, 5);

            // Function now always returns natural direction (from start to end)
            expect(samples.length).toBeGreaterThan(0);

            // First sample should be pointing in positive X direction (right)
            const firstSample = samples[0];
            expect(firstSample.direction.x).toBeGreaterThan(0);
            expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be essentially 0

            // Direction should be normalized
            const magnitude = Math.sqrt(
                firstSample.direction.x ** 2 + firstSample.direction.y ** 2
            );
            expect(magnitude).toBeCloseTo(1.0, 2);
        });

        it('should produce correct direction vectors for clockwise cuts on simple line', () => {
            // Create a simple horizontal line from (0,0) to (10,0)
            const line: Shape = {
                id: 'line1',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = samplePathAtDistanceIntervals(shapes, 5);

            // For clockwise cuts, direction should be natural (pointing right)
            expect(samples.length).toBeGreaterThan(0);

            // First sample should be pointing in positive X direction (right)
            const firstSample = samples[0];
            expect(firstSample.direction.x).toBeGreaterThan(0);
            expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be essentially 0

            // Direction should be normalized
            const magnitude = Math.sqrt(
                firstSample.direction.x ** 2 + firstSample.direction.y ** 2
            );
            expect(magnitude).toBeCloseTo(1.0, 2);
        });

        it('should produce opposite directions when shapes are in opposite order', () => {
            // Create a vertical line and its reverse
            const originalLine: Shape = {
                id: 'line1',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 10 },
                } as Line,
            };

            // For counterclockwise behavior, reverse the line's start/end
            const reversedLine: Shape = {
                id: 'line1-reversed',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
            };

            const originalSamples = samplePathAtDistanceIntervals(
                [originalLine],
                5
            );
            const reversedSamples = samplePathAtDistanceIntervals(
                [reversedLine],
                5
            );

            expect(originalSamples.length).toBeGreaterThan(0);
            expect(reversedSamples.length).toBeGreaterThan(0);

            // Directions should be opposite
            const origDir = originalSamples[0].direction;
            const revDir = reversedSamples[0].direction;

            expect(origDir.x).toBeCloseTo(-revDir.x, 2);
            expect(origDir.y).toBeCloseTo(-revDir.y, 2);
        });

        it('should handle multi-shape paths correctly', () => {
            // Create an L-shaped path: horizontal line then vertical line
            const horizontalLine: Shape = {
                id: 'horizontalLine',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const verticalLine: Shape = {
                id: 'verticalLine',
                type: 'line',
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            };

            const shapes = [horizontalLine, verticalLine];

            const originalSamples = samplePathAtDistanceIntervals(shapes, 5);
            const reversedSamples = samplePathAtDistanceIntervals(
                [verticalLine, horizontalLine],
                5
            );

            // Should have samples from both shapes
            expect(originalSamples.length).toBeGreaterThanOrEqual(2);
            expect(reversedSamples.length).toBeGreaterThanOrEqual(2);

            // For original order, first samples should point right (positive X)
            const originalFirstSample = originalSamples[0];
            expect(originalFirstSample.direction.x).toBeGreaterThan(0);

            // For reversed order, first samples should point up (positive Y) from vertical line
            const reversedFirstSample = reversedSamples[0];
            expect(reversedFirstSample.direction.y).toBeGreaterThan(0);
        });
    });

    describe('Regular Distance Sampling', () => {
        it('should sample at regular intervals', () => {
            // Create a 20-unit long line
            const line: Shape = {
                id: 'line1',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 20, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = samplePathAtDistanceIntervals(shapes, 5); // Sample every 5 units

            // Should have samples at positions ~5, ~10, ~15 (and possibly one more at end)
            expect(samples.length).toBeGreaterThanOrEqual(3);
            expect(samples.length).toBeLessThanOrEqual(4);

            // Check positions are approximately correct for the first few samples
            expect(samples[0].point.x).toBeCloseTo(5, 1);
            expect(samples[1].point.x).toBeCloseTo(10, 1);
            if (samples.length >= 3) {
                expect(samples[2].point.x).toBeCloseTo(15, 1);
            }

            // All samples should be on the Y=0 line
            samples.forEach((sample) => {
                expect(Math.abs(sample.point.y)).toBeLessThan(0.1);
            });
        });

        it('should handle edge cases gracefully', () => {
            // Empty shapes array
            expect(samplePathAtDistanceIntervals([], 5)).toEqual([]);

            // Zero interval distance
            const line: Shape = {
                id: 'line1',
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };
            expect(samplePathAtDistanceIntervals([line], 0)).toEqual([]);

            // Negative interval distance
            expect(samplePathAtDistanceIntervals([line], -5)).toEqual([]);
        });
    });
});

describe('Cut Direction Regression Tests', () => {
    it('should now return natural directions since cut direction is handled at Path level', () => {
        // With the new architecture, samplePathAtDistanceIntervals always returns natural directions
        // The cut direction handling is moved to the Path level via execution chains

        const line: Shape = {
            id: 'line1',
            type: 'line',
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 }, // Horizontal line pointing right
            } as Line,
        };

        // Function now always returns natural direction
        const samples = samplePathAtDistanceIntervals([line], 5);

        expect(samples.length).toBeGreaterThan(0);

        // Direction should always be natural (pointing right) for this line
        const direction = samples[0].direction;
        expect(direction.x).toBeGreaterThan(0); // Should point right in natural direction
        expect(Math.abs(direction.y)).toBeLessThan(0.1); // Should be horizontal

        // The old behavior would have reversed this based on cut direction parameter
    });
});
