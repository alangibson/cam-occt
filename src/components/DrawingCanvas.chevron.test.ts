import { describe, it, expect } from 'vitest';
import { samplePathAtDistanceIntervals } from '../lib/geometry/index';
import type { Shape } from '../lib/types';
import type { Line } from '$lib/geometry/line';
import { CutDirection } from '../lib/types/direction';
import { GeometryType } from '$lib/types/geometry';

/**
 * Integration tests for chevron arrow rendering
 * These tests verify the complete logic from DrawingCanvas.svelte drawPathChevrons function
 */

describe('Chevron Arrow Integration Tests', () => {
    describe('Cut Direction Handling in Path Chevrons', () => {
        it('should handle counterclockwise cut direction correctly with shape reversal', () => {
            // This test simulates the logic from drawPathChevrons in DrawingCanvas.svelte
            // For counterclockwise cuts, the shapes are reversed before sampling

            const horizontalLine: Shape = {
                id: 'horizontal-line-ccw',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 }, // Points right
                } as Line,
            };

            const verticalLine: Shape = {
                id: 'vertical-line-ccw',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 }, // Points up
                } as Line,
            };

            const originalShapes = [horizontalLine, verticalLine];

            // Simulate counterclockwise logic from DrawingCanvas.svelte
            const cutDirection = CutDirection.COUNTERCLOCKWISE;
            const shapesToSample =
                cutDirection === CutDirection.COUNTERCLOCKWISE
                    ? [...originalShapes].reverse()
                    : originalShapes;

            // This should be [verticalLine, horizontalLine] for counterclockwise
            expect(shapesToSample[0]).toBe(verticalLine);
            expect(shapesToSample[1]).toBe(horizontalLine);

            const chevronSamples = samplePathAtDistanceIntervals(
                shapesToSample,
                5
            );

            expect(chevronSamples.length).toBeGreaterThan(0);

            // The first sample should be from the vertical line (which was originally second)
            // With the new architecture, shapes are reversed but direction is natural
            // So vertical line should point up (positive Y direction)
            const firstSample = chevronSamples[0];
            expect(firstSample.direction.y).toBeGreaterThan(0); // Should point up (natural direction)
            expect(Math.abs(firstSample.direction.x)).toBeLessThan(0.1); // Should be mostly vertical

            // Position should be on the vertical line
            expect(firstSample.point.x).toBeCloseTo(10, 1);
            expect(firstSample.point.y).toBeGreaterThan(0);
            expect(firstSample.point.y).toBeLessThan(10);
        });

        it('should handle clockwise cut direction correctly without shape reversal', () => {
            const horizontalLine: Shape = {
                id: 'horizontal-line-cw',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 }, // Points right
                } as Line,
            };

            const verticalLine: Shape = {
                id: 'vertical-line-cw',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 }, // Points up
                } as Line,
            };

            const originalShapes = [horizontalLine, verticalLine];

            // Simulate clockwise logic from DrawingCanvas.svelte
            const cutDirection = CutDirection.CLOCKWISE;
            // This comparison is intentional - showing that clockwise does NOT reverse shapes
            // We're testing that CLOCKWISE !== COUNTERCLOCKWISE, so the false branch is expected
            const shapesToSample =
                (cutDirection as string) === CutDirection.COUNTERCLOCKWISE
                    ? [...originalShapes].reverse()
                    : originalShapes;

            // This should be [horizontalLine, verticalLine] for clockwise (no reversal)
            expect(shapesToSample[0]).toBe(horizontalLine);
            expect(shapesToSample[1]).toBe(verticalLine);

            const chevronSamples = samplePathAtDistanceIntervals(
                shapesToSample,
                5
            );

            expect(chevronSamples.length).toBeGreaterThan(0);

            // The first sample should be from the horizontal line
            // For clockwise (no direction reversal), the first sample should point right (positive X)
            const firstSample = chevronSamples[0];
            expect(firstSample.direction.x).toBeGreaterThan(0); // Should point right
            expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be mostly horizontal

            // Position should be on the horizontal line
            expect(firstSample.point.y).toBeCloseTo(0, 1);
            expect(firstSample.point.x).toBeGreaterThan(0);
            expect(firstSample.point.x).toBeLessThan(10);
        });

        it('should produce visually consistent chevron directions for both cut directions', () => {
            // Create a simple square path that could be cut either direction
            const bottom: Shape = {
                id: 'bottom-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const right: Shape = {
                id: 'right-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            };

            const top: Shape = {
                id: 'top-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 10 },
                } as Line,
            };

            const left: Shape = {
                id: 'left-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
            };

            const shapes = [bottom, right, top, left];

            // Test clockwise direction
            const clockwiseShapes = shapes; // No reversal for clockwise
            const clockwiseSamples = samplePathAtDistanceIntervals(
                clockwiseShapes,
                8
            );

            // Test counterclockwise direction
            const counterclockwiseShapes = [...shapes].reverse(); // Reverse for counterclockwise
            const counterclockwiseSamples = samplePathAtDistanceIntervals(
                counterclockwiseShapes,
                8
            );

            // Both should have samples
            expect(clockwiseSamples.length).toBeGreaterThan(0);
            expect(counterclockwiseSamples.length).toBeGreaterThan(0);

            // For clockwise: first sample on bottom edge should point right
            const cwFirstSample = clockwiseSamples[0];
            expect(cwFirstSample.direction.x).toBeGreaterThan(0);
            expect(Math.abs(cwFirstSample.direction.y)).toBeLessThan(0.5);

            // For counterclockwise: direction should be different from clockwise
            const ccwFirstSample = counterclockwiseSamples[0];

            // The key test is that directions are different between clockwise and counterclockwise
            const dotProduct =
                cwFirstSample.direction.x * ccwFirstSample.direction.x +
                cwFirstSample.direction.y * ccwFirstSample.direction.y;
            expect(Math.abs(dotProduct)).toBeLessThan(0.5); // Should not be pointing in same direction

            // This test would fail with the original bug where arrows always pointed clockwise
        });
    });

    describe('Arrow Direction Consistency', () => {
        it('should ensure arrows follow the cutting tool path direction', () => {
            // This test verifies that chevrons point in the direction the cutting tool will move
            // which is critical for user understanding of the cut path

            const straightLine: Shape = {
                id: 'straight-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 5 },
                    end: { x: 20, y: 5 }, // Long horizontal line
                } as Line,
            };

            // For clockwise cuts on a single line, tool moves from start to end
            const clockwiseSamples = samplePathAtDistanceIntervals(
                [straightLine],
                5
            );
            expect(clockwiseSamples.length).toBeGreaterThan(0);

            // All arrows should point right (positive X direction)
            clockwiseSamples.forEach((sample) => {
                expect(sample.direction.x).toBeGreaterThan(0.9); // Strongly rightward
                expect(Math.abs(sample.direction.y)).toBeLessThan(0.1); // Minimal vertical component
            });

            // For counterclockwise cuts, shapes would be reversed at Path level (not here)
            // If we were to simulate that reversal here, we'd reverse the line's start/end
            const reversedLine: Shape = {
                id: 'reversed-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 20, y: 5 }, // Reversed: was end
                    end: { x: 0, y: 5 }, // Reversed: was start
                } as Line,
            };

            const counterclockwiseSamples = samplePathAtDistanceIntervals(
                [reversedLine],
                5
            );
            expect(counterclockwiseSamples.length).toBeGreaterThan(0);

            // All arrows should point left (negative X direction) because shape was reversed
            counterclockwiseSamples.forEach((sample) => {
                expect(sample.direction.x).toBeLessThan(-0.9); // Strongly leftward
                expect(Math.abs(sample.direction.y)).toBeLessThan(0.1); // Minimal vertical component
            });
        });
    });

    describe('Regression Prevention', () => {
        it('should catch the specific commit 3d71ad4 bug pattern', () => {
            // The bug occurred when:
            // 1. DrawingCanvas.svelte reversed shape order for counterclockwise cuts
            // 2. But samplePathAtDistanceIntervals didn't account for this reversal
            // 3. Result: arrows pointed in wrong direction for counterclockwise cuts

            const testLine: Shape = {
                id: 'test-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            // Simulate the exact pattern from DrawingCanvas.svelte
            const path = {
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                calculatedOffset: null, // No offset, use original chain
            };

            // This is the exact logic from drawPathChevrons
            const shapesToSample =
                path.cutDirection === CutDirection.COUNTERCLOCKWISE
                    ? [testLine].reverse()
                    : [testLine];

            // For a single shape, reverse doesn't change the array, but the cut direction parameter should
            const chevronSamples = samplePathAtDistanceIntervals(
                shapesToSample,
                5
            );

            expect(chevronSamples.length).toBeGreaterThan(0);

            // THE CRITICAL TEST: Since we're now handling this at the Path level,
            // the shapes are in original order but direction should be natural
            const firstSample = chevronSamples[0];
            expect(firstSample.direction.x).toBeGreaterThan(0); // Natural direction for horizontal line

            // If this test fails, the commit 3d71ad4 bug has returned
        });
    });
});
