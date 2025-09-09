import { describe, it, expect } from 'vitest';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';
import { offsetChain } from './offset';
import type { Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';
import type { OffsetChain } from './types';
import { generateChainOffsetSVG } from '../../../test/visual-tests';

describe('Flipped Arc Gap Filling Debug', () => {
    function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
        return {
            id: `line-${Math.random()}`,
            type: GeometryType.LINE,
            geometry: {
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
            },
        };
    }

    it('should visualize the flipped arc gap filling issue', () => {
        // Create just the problematic section: 2 lines and the flipped arc
        // This is the exact same arc definition from the chain-closed-flipped-arc test
        const shapes: Shape[] = [
            createLine(100, 50, 200, 50), // Bottom line
            {
                // Flipped arc (curves outward)
                id: `arc-${Math.random()}`,
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 230, y: 50 }, // Different center to create outward curve
                    radius: 30,
                    startAngle: Math.PI, // Start pointing left (toward 200,50)
                    endAngle: Math.PI / 2, // End pointing up (toward 230,80)
                    clockwise: true, // Clockwise direction
                },
            },
            createLine(230, 80, 230, 150), // Right line
            createLine(230, 150, 100, 50), // Close the shape
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.1,
            maxTraversalAttempts: 5,
        });

        const offsetDistance = 8;
        const chainOffsetResult = offsetChain(chain, offsetDistance, {
            tolerance: 0.1,
            maxExtension: 50,
            snapThreshold: 0.5,
        });

        // Collect offset chains for visualization
        const offsets: OffsetChain[] = [];
        if (chainOffsetResult.innerChain) {
            offsets.push(chainOffsetResult.innerChain);
        }
        if (chainOffsetResult.outerChain) {
            offsets.push(chainOffsetResult.outerChain);
        }

        // Generate SVG using the same function as the working test
        generateChainOffsetSVG(chain, offsets, 'flipped-arc-gap-debug', {
            width: 800,
            height: 600,
        });

        // Assert that the offset operation was successful
        expect(chainOffsetResult.success).toBe(true);

        // Assert that both inner and outer chains were created
        expect(chainOffsetResult.innerChain).toBeDefined();
        expect(chainOffsetResult.outerChain).toBeDefined();

        // Each offset chain should have 4 intersection points (one between each consecutive pair of offset shapes)
        // For a closed chain with 4 shapes, we expect 4 intersections: shape0↔shape1, shape1↔shape2, shape2↔shape3, shape3↔shape0
        expect(chainOffsetResult.innerChain!.intersectionPoints).toBeDefined();
        expect(chainOffsetResult.innerChain!.intersectionPoints!.length).toBe(
            4
        );

        expect(chainOffsetResult.outerChain!.intersectionPoints).toBeDefined();
        expect(chainOffsetResult.outerChain!.intersectionPoints!.length).toBe(
            4
        );
    });
});
