import { describe, it, expect } from 'vitest';
import {
    calculateLeads,
    type LeadInConfig,
    type LeadOutConfig,
} from './lead-calculation';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import type { Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';

describe('calculateLeads', () => {
    // Helper to create a simple line chain
    function createLineChain(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): Chain {
        const shape: Shape = {
            id: 'shape1',
            type: GeometryType.LINE,
            geometry: { start, end },
            layer: 'layer1',
        };

        return {
            id: 'chain1',
            shapes: [shape],
        };
    }

    // Helper to create a circle chain
    function createCircleChain(
        center: { x: number; y: number },
        radius: number
    ): Chain {
        const shape: Shape = {
            id: 'shape1',
            type: GeometryType.CIRCLE,
            geometry: { center, radius },
            layer: 'layer1',
        };

        return {
            id: 'chain1',
            shapes: [shape],
        };
    }

    describe('no leads', () => {
        it('should return empty result when both leads are none', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadInConfig = { type: LeadType.NONE, length: 0 };
            const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadIn).toBeUndefined();
            expect(result.leadOut).toBeUndefined();
        });
    });

    describe('arc leads', () => {
        it('should calculate arc lead-in for horizontal line', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 5 };
            const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadIn).toBeDefined();
            expect(result.leadIn?.type).toBe('arc');
            expect(result.leadIn?.points).toBeDefined();
            expect(result.leadIn?.points.length).toBeGreaterThan(2); // Arc should have multiple points

            // Lead-in should end at the start of the line
            const lastPoint =
                result.leadIn?.points[result.leadIn.points.length - 1];
            expect(lastPoint?.x).toBeCloseTo(0, 5);
            expect(lastPoint?.y).toBeCloseTo(0, 5);
        });

        it('should calculate arc lead-out for horizontal line', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadInConfig = { type: LeadType.NONE, length: 0 };
            const leadOut: LeadOutConfig = { type: LeadType.ARC, length: 5 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadOut).toBeDefined();
            expect(result.leadOut?.type).toBe('arc');
            expect(result.leadOut?.points).toBeDefined();
            expect(result.leadOut?.points.length).toBeGreaterThan(2);

            // Lead-out should start at the end of the line
            const firstPoint = result.leadOut?.points[0];
            expect(firstPoint?.x).toBeCloseTo(10, 5);
            expect(firstPoint?.y).toBeCloseTo(0, 5);
        });

        it('should limit arc sweep to 90 degrees', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 100 }; // Very long arc
            const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadIn).toBeDefined();

            // With a 90-degree max sweep, radius = length / (π/2)
            // So for length 100, radius ≈ 63.66
            // The arc should sweep 90 degrees max

            // Check that the arc doesn't extend too far
            const points = result.leadIn?.points || [];
            for (const point of points) {
                // For a 90-degree arc on a horizontal line, lead-in should be below or to the left
                expect(point.x).toBeLessThanOrEqual(0.1); // Small tolerance
            }
        });

        it('should calculate lead for circle', () => {
            const chain = createCircleChain({ x: 5, y: 5 }, 3);
            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 4 };
            const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadIn).toBeDefined();
            expect(result.leadIn?.type).toBe('arc');

            // Circle starts at rightmost point (8, 5)
            const lastPoint =
                result.leadIn?.points[result.leadIn.points.length - 1];
            expect(lastPoint?.x).toBeCloseTo(8, 5);
            expect(lastPoint?.y).toBeCloseTo(5, 5);
        });
    });

    describe('part context (holes vs shells)', () => {
        it('should place lead inside for holes', () => {
            const holeChain = createCircleChain({ x: 5, y: 5 }, 3);
            const shellChain = createCircleChain({ x: 5, y: 5 }, 10);

            const part: DetectedPart = {
                id: 'part1',
                shell: {
                    id: 'shell1',
                    chain: shellChain,
                    type: PartType.SHELL,
                    boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                    holes: [],
                },
                holes: [
                    {
                        id: 'hole1',
                        chain: holeChain,
                        type: PartType.HOLE,
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                        holes: [],
                    },
                ],
            };

            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 2 };
            const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(
                holeChain,
                leadIn,
                leadOut,
                CutDirection.NONE,
                part
            );

            expect(result.leadIn).toBeDefined();

            // For a hole, the lead should be inside the circle
            // The hole starts at (8, 5), and the lead should curve inward
            const points = result.leadIn?.points || [];

            // Check that lead points are inside the circle (distance from center < radius)
            for (let i: number = 0; i < points.length - 1; i++) {
                // Exclude last point which is on the circle
                const point = points[i];
                const distFromCenter = Math.sqrt(
                    Math.pow(point.x - 5, 2) + Math.pow(point.y - 5, 2)
                );
                expect(distFromCenter).toBeLessThan(3.1); // Slightly more than radius for tolerance
            }
        });

        it('should place lead outside for shells', () => {
            const shellChain = createCircleChain({ x: 5, y: 5 }, 3);

            const part: DetectedPart = {
                id: 'part1',
                shell: {
                    id: 'shell1',
                    chain: shellChain,
                    type: PartType.SHELL,
                    boundingBox: { min: { x: 2, y: 2 }, max: { x: 8, y: 8 } },
                    holes: [],
                },
                holes: [],
            };

            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 2 };
            const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(
                shellChain,
                leadIn,
                leadOut,
                CutDirection.NONE,
                part
            );

            expect(result.leadIn).toBeDefined();

            // For a shell, the lead should be outside the circle
            // The shell starts at (8, 5), and the lead should curve outward
            const points = result.leadIn?.points || [];

            // Check that lead points are outside the circle (distance from center > radius)
            for (let i: number = 0; i < points.length - 1; i++) {
                // Exclude last point which is on the circle
                const point = points[i];
                const distFromCenter = Math.sqrt(
                    Math.pow(point.x - 5, 2) + Math.pow(point.y - 5, 2)
                );
                expect(distFromCenter).toBeGreaterThan(2.9); // Slightly less than radius for tolerance
            }
        });
    });

    describe('edge cases', () => {
        it('should handle empty chain', () => {
            const chain: Chain = {
                id: 'chain1',
                shapes: [],
            };

            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 5 };
            const leadOut: LeadOutConfig = { type: LeadType.ARC, length: 5 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadIn).toBeUndefined();
            expect(result.leadOut).toBeUndefined();
        });

        it('should handle zero length leads', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadInConfig = { type: LeadType.ARC, length: 0 };
            const leadOut: LeadOutConfig = { type: LeadType.ARC, length: 0 };

            const result = calculateLeads(chain, leadIn, leadOut);

            expect(result.leadIn).toBeUndefined();
            expect(result.leadOut).toBeUndefined();
        });
    });
});
