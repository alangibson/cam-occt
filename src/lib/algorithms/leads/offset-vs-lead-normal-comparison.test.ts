import { describe, it } from 'vitest';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/types/geometry';
import type { Shape, Line } from '$lib/types';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { offsetChain } from '$lib/algorithms/offset-calculation/chain/offset';

/**
 * Test to compare normal directions used for:
 * 1. Creating offsets (which works correctly)
 * 2. Creating leads on offset chains (which fails)
 *
 * The same normal calculation logic should work for both.
 */
describe('Offset vs Lead Normal Direction Comparison', () => {
    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to create a simple rectangular chain
    function createRectangleChain(): Chain {
        const shapes: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                layer: 'layer1',
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
                layer: 'layer1',
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 10 },
                } as Line,
                layer: 'layer1',
            },
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
                layer: 'layer1',
            },
        ];

        return {
            id: 'rectangle-chain',
            shapes,
            clockwise: true, // CW rectangle
        };
    }

    describe('Compare offset creation vs lead creation normal directions', () => {
        it('should demonstrate that offset calculation and lead calculation may use different normal directions', async () => {
            const originalChain = createRectangleChain();
            const offsetDistance = 1.0; // 1 unit inward offset

            console.log('=== Original Chain ===');
            console.log('Chain clockwise:', originalChain.clockwise);
            console.log('Chain shapes count:', originalChain.shapes.length);

            // 1. Create offset using the offset calculation (which works correctly)
            console.log('\n=== Creating Offset ===');
            const offsetResult = offsetChain(
                originalChain,
                -offsetDistance // negative for inset
            );

            if (offsetResult.success && offsetResult.innerChain) {
                console.log('Offset created successfully');
                console.log(
                    'Inner offset shapes count:',
                    offsetResult.innerChain.shapes.length
                );

                // Create offset chain
                const offsetChain: Chain = {
                    id: originalChain.id + '_offset',
                    shapes: offsetResult.innerChain.shapes,
                    clockwise: originalChain.clockwise,
                };

                console.log('\n=== Original Chain Lead Calculation ===');
                // 2. Calculate leads on original chain
                const originalLeadResult = calculateLeads(
                    originalChain,
                    baseLeadConfig,
                    { type: LeadType.NONE, length: 0 },
                    CutDirection.CLOCKWISE
                );

                console.log(
                    'Original chain lead normal:',
                    originalLeadResult.leadIn?.normal
                );

                console.log('\n=== Offset Chain Lead Calculation ===');
                // 3. Calculate leads on offset chain
                const offsetLeadResult = calculateLeads(
                    offsetChain,
                    baseLeadConfig,
                    { type: LeadType.NONE, length: 0 },
                    CutDirection.CLOCKWISE
                );

                console.log(
                    'Offset chain lead normal:',
                    offsetLeadResult.leadIn?.normal
                );

                // 4. Compare the results
                if (originalLeadResult.leadIn && offsetLeadResult.leadIn) {
                    const originalNormal = originalLeadResult.leadIn.normal;
                    const offsetNormal = offsetLeadResult.leadIn.normal;

                    console.log('\n=== Comparison ===');
                    console.log('Original normal:', originalNormal);
                    console.log('Offset normal:', offsetNormal);

                    // Check if they point in the same general direction
                    if (originalNormal && offsetNormal) {
                        const dotProduct =
                            originalNormal.x * offsetNormal.x +
                            originalNormal.y * offsetNormal.y;
                        console.log(
                            'Dot product (1=same, -1=opposite, 0=perpendicular):',
                            dotProduct
                        );

                        if (dotProduct < 0) {
                            console.log(
                                '❌ Normals point in OPPOSITE directions - this indicates the bug!'
                            );
                        } else if (dotProduct > 0.7) {
                            console.log(
                                '✅ Normals point in SAME general direction'
                            );
                        } else {
                            console.log(
                                '⚠️  Normals are at an angle to each other'
                            );
                        }

                        // The key insight: if the offset was created correctly (inward),
                        // then leads on that offset chain should also point inward relative to the original
                        // This means the normals should be consistent in their "inward/outward" orientation
                    }
                }
            } else {
                console.log('Offset calculation failed:', offsetResult.errors);
            }
        });

        it('should test with different offset directions', async () => {
            const originalChain = createRectangleChain();

            for (const direction of [
                OffsetDirection.INSET,
                OffsetDirection.OUTSET,
            ]) {
                console.log(`\n=== Testing ${direction} offset ===`);

                const offsetDistance =
                    direction === OffsetDirection.INSET ? -1.0 : 1.0;
                const offsetResult = offsetChain(originalChain, offsetDistance);

                if (offsetResult.success) {
                    const offsetShapes =
                        direction === OffsetDirection.INSET
                            ? offsetResult.innerChain?.shapes || []
                            : offsetResult.outerChain?.shapes || [];

                    if (offsetShapes) {
                        const offsetChain: Chain = {
                            id: originalChain.id + '_offset_' + direction,
                            shapes: offsetShapes,
                            clockwise: originalChain.clockwise,
                        };

                        const originalLeadResult = calculateLeads(
                            originalChain,
                            baseLeadConfig,
                            { type: LeadType.NONE, length: 0 },
                            CutDirection.CLOCKWISE
                        );

                        const offsetLeadResult = calculateLeads(
                            offsetChain,
                            baseLeadConfig,
                            { type: LeadType.NONE, length: 0 },
                            CutDirection.CLOCKWISE
                        );

                        if (
                            originalLeadResult.leadIn &&
                            offsetLeadResult.leadIn &&
                            originalLeadResult.leadIn.normal &&
                            offsetLeadResult.leadIn.normal
                        ) {
                            const dotProduct =
                                originalLeadResult.leadIn.normal.x *
                                    offsetLeadResult.leadIn.normal.x +
                                originalLeadResult.leadIn.normal.y *
                                    offsetLeadResult.leadIn.normal.y;

                            console.log(
                                `${direction} - Original normal:`,
                                originalLeadResult.leadIn.normal
                            );
                            console.log(
                                `${direction} - Offset normal:`,
                                offsetLeadResult.leadIn.normal
                            );
                            console.log(
                                `${direction} - Dot product:`,
                                dotProduct
                            );
                        }
                    }
                }
            }
        });

        it('should analyze the specific normal calculation differences', () => {
            // This test will help us understand exactly where the normal calculation diverges
            const originalChain = createRectangleChain();

            // Test with a simple case where we can manually verify the expected normal direction
            console.log('\n=== Manual Normal Analysis ===');
            console.log(
                'Rectangle starts at (0,0) going to (10,0) - horizontal line going right'
            );
            console.log(
                'For a clockwise rectangle, the "inside" should be up and right from this line'
            );
            console.log('So the inward normal should point UP: (0, 1)');
            console.log(
                'And leads should point OUTWARD from the shape: (0, -1)'
            );

            const leadResult = calculateLeads(
                originalChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE
            );

            if (leadResult.leadIn && leadResult.leadIn.normal) {
                console.log('Actual lead normal:', leadResult.leadIn.normal);

                // For a clockwise rectangle starting with a horizontal line going right,
                // we can determine what the correct normal direction should be
                const expectedNormal = { x: 0, y: -1 }; // Should point down (outward from rectangle)
                console.log(
                    'Expected normal for outward lead:',
                    expectedNormal
                );

                const matches =
                    Math.abs(leadResult.leadIn.normal.x - expectedNormal.x) <
                        0.1 &&
                    Math.abs(leadResult.leadIn.normal.y - expectedNormal.y) <
                        0.1;

                console.log('Matches expectation:', matches ? '✅' : '❌');
            }
        });
    });
});
