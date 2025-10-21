/**
 * Tests for sampleChainAtDistanceInterval function
 */

import { describe, it, expect } from 'vitest';
import { sampleChainAtDistanceInterval } from './functions';
import type { Chain } from './interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('sampleChainAtDistanceInterval', () => {
    it('should return empty array for empty chain', () => {
        const emptyChain: Chain = {
            id: 'empty-chain',
            shapes: [],
        };

        const samples = sampleChainAtDistanceInterval(emptyChain, 1.0);

        expect(samples).toEqual([]);
    });

    it('should return empty array for zero interval distance', () => {
        const lineShape: Shape = {
            id: 'line-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const chain: Chain = {
            id: 'test-chain',
            shapes: [lineShape],
        };

        const samples = sampleChainAtDistanceInterval(chain, 0);

        expect(samples).toEqual([]);
    });

    it('should sample a simple horizontal line at regular intervals', () => {
        const lineShape: Shape = {
            id: 'horizontal-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const chain: Chain = {
            id: 'test-chain',
            shapes: [lineShape],
        };

        const samples = sampleChainAtDistanceInterval(chain, 2.5);

        // Line is 10 units long, samples at 2.5, 5.0, 7.5, 10.0
        expect(samples.length).toBe(4);

        // First sample at x=2.5
        expect(samples[0].point.x).toBeCloseTo(2.5);
        expect(samples[0].point.y).toBeCloseTo(0);
        expect(samples[0].direction.x).toBeGreaterThan(0.9); // Pointing right

        // Second sample at x=5.0
        expect(samples[1].point.x).toBeCloseTo(5.0);
        expect(samples[1].point.y).toBeCloseTo(0);

        // Third sample at x=7.5
        expect(samples[2].point.x).toBeCloseTo(7.5);
        expect(samples[2].point.y).toBeCloseTo(0);

        // Fourth sample at x=10.0
        expect(samples[3].point.x).toBeCloseTo(10.0);
        expect(samples[3].point.y).toBeCloseTo(0);
    });

    it('should sample a vertical line correctly', () => {
        const lineShape: Shape = {
            id: 'vertical-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 5, y: 0 },
                end: { x: 5, y: 10 },
            } as Line,
        };

        const chain: Chain = {
            id: 'test-chain',
            shapes: [lineShape],
        };

        const samples = sampleChainAtDistanceInterval(chain, 3.0);

        // Line is 10 units long, samples at 3.0, 6.0, 9.0
        expect(samples.length).toBe(3);

        // All samples should be at x=5
        samples.forEach((sample) => {
            expect(sample.point.x).toBeCloseTo(5);
            expect(sample.direction.y).toBeGreaterThan(0.9); // Pointing up
        });

        // Check y coordinates
        expect(samples[0].point.y).toBeCloseTo(3.0);
        expect(samples[1].point.y).toBeCloseTo(6.0);
        expect(samples[2].point.y).toBeCloseTo(9.0);
    });

    it('should sample across multiple connected line segments', () => {
        const line1: Shape = {
            id: 'line-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const line2: Shape = {
            id: 'line-2',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 10, y: 0 },
                end: { x: 10, y: 10 },
            } as Line,
        };

        const chain: Chain = {
            id: 'l-shape',
            shapes: [line1, line2],
        };

        const samples = sampleChainAtDistanceInterval(chain, 5.0);

        // Total length is 20 units (10 + 10)
        // Samples at 5, 10, 15, 20
        expect(samples.length).toBe(4);

        // First sample at 5 units - on first line
        expect(samples[0].point.x).toBeCloseTo(5);
        expect(samples[0].point.y).toBeCloseTo(0);
        expect(samples[0].direction.x).toBeGreaterThan(0.9); // Horizontal

        // Second sample at 10 units - at junction (start of second line)
        expect(samples[1].point.x).toBeCloseTo(10);
        expect(samples[1].point.y).toBeCloseTo(0);

        // Third sample at 15 units - on second line (5 units up from bottom)
        expect(samples[2].point.x).toBeCloseTo(10);
        expect(samples[2].point.y).toBeCloseTo(5);
        expect(samples[2].direction.y).toBeGreaterThan(0.9); // Vertical

        // Fourth sample at 20 units - at end of second line
        expect(samples[3].point.x).toBeCloseTo(10);
        expect(samples[3].point.y).toBeCloseTo(10);
        expect(samples[3].direction.y).toBeGreaterThan(0.9); // Vertical
    });

    it('should handle very small interval distance', () => {
        const lineShape: Shape = {
            id: 'line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 1, y: 0 },
            } as Line,
        };

        const chain: Chain = {
            id: 'test-chain',
            shapes: [lineShape],
        };

        // Sample every 0.001 units (CONTAINMENT_AREA_TOLERANCE)
        const samples = sampleChainAtDistanceInterval(chain, 0.001);

        // Should get many samples
        expect(samples.length).toBeGreaterThan(900);

        // All samples should be on the line y=0
        samples.forEach((sample) => {
            expect(sample.point.y).toBeCloseTo(0, 6);
            expect(sample.point.x).toBeGreaterThan(0);
            expect(sample.point.x).toBeLessThan(1);
        });
    });

    it('should provide normalized direction vectors', () => {
        const lineShape: Shape = {
            id: 'diagonal-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
            } as Line,
        };

        const chain: Chain = {
            id: 'test-chain',
            shapes: [lineShape],
        };

        const samples = sampleChainAtDistanceInterval(chain, 3.0);

        // All direction vectors should be normalized (length ~= 1)
        samples.forEach((sample) => {
            const length = Math.sqrt(
                sample.direction.x ** 2 + sample.direction.y ** 2
            );
            expect(length).toBeCloseTo(1.0, 5);
        });

        // For a 45-degree line, both components should be ~0.707
        samples.forEach((sample) => {
            expect(sample.direction.x).toBeCloseTo(0.707, 2);
            expect(sample.direction.y).toBeCloseTo(0.707, 2);
        });
    });

    it('should handle chain with single point (degenerate case)', () => {
        // Zero-length line
        const lineShape: Shape = {
            id: 'point',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 },
            } as Line,
        };

        const chain: Chain = {
            id: 'degenerate-chain',
            shapes: [lineShape],
        };

        const samples = sampleChainAtDistanceInterval(chain, 1.0);

        // Zero-length shape produces no samples
        expect(samples).toEqual([]);
    });

    it('should work with CONTAINMENT_AREA_TOLERANCE value', () => {
        const CONTAINMENT_AREA_TOLERANCE = 0.001;

        const lineShape: Shape = {
            id: 'line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 0.1, y: 0 },
            } as Line,
        };

        const chain: Chain = {
            id: 'test-chain',
            shapes: [lineShape],
        };

        const samples = sampleChainAtDistanceInterval(
            chain,
            CONTAINMENT_AREA_TOLERANCE
        );

        // 0.1 unit line with 0.001 interval = ~99 samples
        expect(samples.length).toBeGreaterThan(90);
        expect(samples.length).toBeLessThan(100);

        // All samples should be along the line
        samples.forEach((sample) => {
            expect(sample.point.y).toBeCloseTo(0);
            expect(sample.point.x).toBeGreaterThanOrEqual(0);
            expect(sample.point.x).toBeLessThanOrEqual(0.1);
        });
    });
});
