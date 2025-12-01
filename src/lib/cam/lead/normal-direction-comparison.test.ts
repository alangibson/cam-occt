import { describe, expect, it } from 'vitest';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { getChainTangent } from '$lib/cam/chain/functions';
import { Chain } from '$lib/cam/chain/classes';

/**
 * Test to isolate the bug where normal directions are calculated correctly on original chains
 * but incorrectly on offset chains, even though the same geometry and code should produce
 * identical results.
 */
describe('Normal Direction Comparison: Original vs Offset Chains', () => {
    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to create a simple horizontal line chain
    function createHorizontalLineChain(
        start: Point2D = { x: 0, y: 0 },
        end: Point2D = { x: 10, y: 0 }
    ): ChainData {
        const shape: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: { start, end } as Line,
            layer: 'layer1',
        };

        return {
            id: 'chain1',
            name: 'chain1', shapes: [shape],
            clockwise: true,
        };
    }

    // Helper to create an "offset" chain with identical geometry but different chain ID
    function createIdenticalOffsetChain(originalChain: ChainData): ChainData {
        return {
            ...originalChain,
            id: 'offset-chain1', // Different ID to simulate offset chain
            shapes: originalChain.shapes.map((shape) => ({
                ...shape,
                id: shape.id + '-offset',
            })),
        };
    }

    describe('Tangent calculation consistency', () => {
        it('should calculate identical tangents for identical geometry', () => {
            const originalChainData = createHorizontalLineChain();
            const offsetChainData =
                createIdenticalOffsetChain(originalChainData);

            const originalChain = new Chain(originalChainData);
            const offsetChain = new Chain(offsetChainData);

            const originalStartPoint = { x: 0, y: 0 };
            const offsetStartPoint = { x: 0, y: 0 };

            const originalTangent = getChainTangent(
                originalChain,
                originalStartPoint,
                true
            );
            const offsetTangent = getChainTangent(
                offsetChain,
                offsetStartPoint,
                true
            );

            console.log('Original tangent:', originalTangent);
            console.log('Offset tangent:', offsetTangent);

            expect(originalTangent.x).toBeCloseTo(offsetTangent.x, 6);
            expect(originalTangent.y).toBeCloseTo(offsetTangent.y, 6);
        });
    });

    describe('Lead normal direction consistency', () => {
        it('should calculate identical lead normals for identical geometry', () => {
            const originalChain = createHorizontalLineChain();
            const offsetChain = createIdenticalOffsetChain(originalChain);

            // Calculate leads with same configuration
            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const offsetResult = calculateLeads(
                new Chain(offsetChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log('Original lead result:', originalResult.leadIn);
            console.log('Offset lead result:', offsetResult.leadIn);

            expect(originalResult.leadIn).toBeDefined();
            expect(offsetResult.leadIn).toBeDefined();

            if (originalResult.leadIn && offsetResult.leadIn) {
                // Compare normal directions
                const originalNormal = originalResult.leadIn.normal;
                const offsetNormal = offsetResult.leadIn.normal;

                console.log('Original normal:', originalNormal);
                console.log('Offset normal:', offsetNormal);

                // These should be identical for identical geometry
                if (originalNormal && offsetNormal) {
                    expect(originalNormal.x).toBeCloseTo(offsetNormal.x, 6);
                    expect(originalNormal.y).toBeCloseTo(offsetNormal.y, 6);
                }
            }
        });

        it('should calculate identical lead normals with different cut directions', () => {
            const originalChain = createHorizontalLineChain();
            const offsetChain = createIdenticalOffsetChain(originalChain);

            // Test both cut directions
            for (const cutDirection of [
                CutDirection.CLOCKWISE,
                CutDirection.COUNTERCLOCKWISE,
            ]) {
                const originalResult = calculateLeads(
                    new Chain(originalChain),
                    baseLeadConfig,
                    { type: LeadType.NONE, length: 0 },
                    cutDirection,
                    undefined,
                    { x: 1, y: 0 }
                );

                const offsetResult = calculateLeads(
                    new Chain(offsetChain),
                    baseLeadConfig,
                    { type: LeadType.NONE, length: 0 },
                    cutDirection,
                    undefined,
                    { x: 1, y: 0 }
                );

                console.log(`Cut direction ${cutDirection}:`);
                console.log(
                    '  Original normal:',
                    originalResult.leadIn?.normal
                );
                console.log('  Offset normal:', offsetResult.leadIn?.normal);

                if (
                    originalResult.leadIn &&
                    offsetResult.leadIn &&
                    originalResult.leadIn.normal &&
                    offsetResult.leadIn.normal
                ) {
                    expect(originalResult.leadIn.normal.x).toBeCloseTo(
                        offsetResult.leadIn.normal.x,
                        6
                    );
                    expect(originalResult.leadIn.normal.y).toBeCloseTo(
                        offsetResult.leadIn.normal.y,
                        6
                    );
                }
            }
        });

        it('should detect when normal directions differ unexpectedly', () => {
            // This test is designed to FAIL and expose the bug
            const originalChain = createHorizontalLineChain();

            // Create a chain that represents what an actual offset chain might look like
            // This might have modified endpoints, different shape ordering, etc.
            const modifiedChain = createHorizontalLineChain(
                { x: 1, y: 1 },
                { x: 11, y: 1 }
            );

            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const modifiedResult = calculateLeads(
                new Chain(modifiedChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log(
                'Original chain lead normal:',
                originalResult.leadIn?.normal
            );
            console.log(
                'Modified chain lead normal:',
                modifiedResult.leadIn?.normal
            );

            // If there's a bug, these might differ when they shouldn't
            // This test will help us identify the specific conditions that cause the problem
        });
    });

    describe('Material avoidance logic consistency', () => {
        it('should make identical material avoidance decisions for identical geometry', () => {
            // Create chains with identical geometry but different contexts
            const originalChain = createHorizontalLineChain();
            const offsetChain = createIdenticalOffsetChain(originalChain);

            // Test with no part context (should behave identically)
            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.NONE, // No cut direction to isolate material avoidance logic
                undefined,
                { x: 1, y: 0 }
            );

            const offsetResult = calculateLeads(
                new Chain(offsetChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.NONE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log(
                'No cut direction - Original normal:',
                originalResult.leadIn?.normal
            );
            console.log(
                'No cut direction - Offset normal:',
                offsetResult.leadIn?.normal
            );

            if (
                originalResult.leadIn &&
                offsetResult.leadIn &&
                originalResult.leadIn.normal &&
                offsetResult.leadIn.normal
            ) {
                // Should be identical when no part context and no cut direction preference
                expect(originalResult.leadIn.normal.x).toBeCloseTo(
                    offsetResult.leadIn.normal.x,
                    6
                );
                expect(originalResult.leadIn.normal.y).toBeCloseTo(
                    offsetResult.leadIn.normal.y,
                    6
                );
            }
        });
    });

    describe('Chain property influence', () => {
        it('should test how chain clockwise property affects normal direction', () => {
            const cwChain = createHorizontalLineChain();
            cwChain.clockwise = true;

            const ccwChain = createHorizontalLineChain();
            ccwChain.clockwise = false;

            const cwResult = calculateLeads(
                new Chain(cwChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const ccwResult = calculateLeads(
                new Chain(ccwChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log('CW chain normal:', cwResult.leadIn?.normal);
            console.log('CCW chain normal:', ccwResult.leadIn?.normal);

            // This will help us understand if chain.clockwise property affects normal direction
            // and whether offset chains have different clockwise values than originals
        });
    });
});
