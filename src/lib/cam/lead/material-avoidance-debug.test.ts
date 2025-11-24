import { describe, it } from 'vitest';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { Chain } from '$lib/cam/chain/classes';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { isPointInsideChainExact } from '$lib/cam/chain/point-in-chain';
import { getChainTangent } from '$lib/cam/chain/functions';

/**
 * Debug test to understand the material avoidance logic and identify the correct behavior
 */
describe('Material Avoidance Logic Debug', () => {
    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to create a simple clockwise rectangle
    function createClockwiseRectangle(): ChainData {
        const shapes: ShapeData[] = [
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
            id: 'clockwise-rectangle',
            shapes,
            clockwise: true,
        };
    }

    describe('Manual material avoidance analysis', () => {
        it('should analyze what the correct normal direction should be', () => {
            const chain = new Chain(createClockwiseRectangle());
            const startPoint = { x: 0, y: 0 };

            console.log('=== Chain Analysis ===');
            console.log('Chain clockwise:', chain.clockwise);
            console.log('Start point:', startPoint);

            // Get tangent at start point
            const tangent = getChainTangent(chain, startPoint, true);
            console.log('Tangent direction:', tangent);

            // Calculate normal directions
            const leftNormal = { x: -tangent.y, y: tangent.x }; // 90° CCW from tangent
            const rightNormal = { x: tangent.y, y: -tangent.x }; // 90° CW from tangent

            console.log('Left normal (CCW from tangent):', leftNormal);
            console.log('Right normal (CW from tangent):', rightNormal);

            // Test points along each normal direction
            const testDistance = 2;
            const leftTestPoint = {
                x: startPoint.x + leftNormal.x * testDistance,
                y: startPoint.y + leftNormal.y * testDistance,
            };
            const rightTestPoint = {
                x: startPoint.x + rightNormal.x * testDistance,
                y: startPoint.y + rightNormal.y * testDistance,
            };

            console.log('Left test point:', leftTestPoint);
            console.log('Right test point:', rightTestPoint);

            // Check which points are inside the chain
            const leftInChain = isPointInsideChainExact(leftTestPoint, chain);
            const rightInChain = isPointInsideChainExact(rightTestPoint, chain);

            console.log('Left test point inside chain:', leftInChain);
            console.log('Right test point inside chain:', rightInChain);

            console.log('\n=== Material Avoidance Logic ===');
            console.log('For a clockwise rectangle (shell):');
            console.log('- Inside = material (should avoid)');
            console.log('- Outside = air (leads should go here)');
            console.log('');
            if (leftInChain && !rightInChain) {
                console.log(
                    '✅ Correct: Left is inside (material), Right is outside (air)'
                );
                console.log('✅ Lead should use RIGHT normal (outward)');
            } else if (!leftInChain && rightInChain) {
                console.log(
                    '✅ Correct: Left is outside (air), Right is inside (material)'
                );
                console.log('✅ Lead should use LEFT normal (outward)');
            } else if (!leftInChain && !rightInChain) {
                console.log(
                    '⚠️  Both directions are outside - need cut direction logic'
                );
            } else {
                console.log(
                    '❌ Both directions are inside - something is wrong'
                );
            }

            // What does the actual lead calculation choose?
            const leadResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            if (leadResult.leadIn && leadResult.leadIn.normal) {
                console.log('\n=== Actual Lead Result ===');
                console.log('Lead normal:', leadResult.leadIn.normal);

                // Check which normal it matches
                const matchesLeft =
                    Math.abs(leadResult.leadIn.normal.x - leftNormal.x) < 0.1 &&
                    Math.abs(leadResult.leadIn.normal.y - leftNormal.y) < 0.1;

                const matchesRight =
                    Math.abs(leadResult.leadIn.normal.x - rightNormal.x) <
                        0.1 &&
                    Math.abs(leadResult.leadIn.normal.y - rightNormal.y) < 0.1;

                if (matchesLeft) {
                    console.log('Lead chose LEFT normal');
                    console.log(
                        'Is this correct?',
                        !leftInChain ? '✅ YES (outward)' : '❌ NO (inward)'
                    );
                } else if (matchesRight) {
                    console.log('Lead chose RIGHT normal');
                    console.log(
                        'Is this correct?',
                        !rightInChain ? '✅ YES (outward)' : '❌ NO (inward)'
                    );
                } else {
                    console.log('Lead chose some other direction');
                }
            }
        });

        it('should test counter-clockwise rectangle to see if the issue is specific to CW', () => {
            // Create CCW rectangle (reverse the order)
            const ccwChainData = createClockwiseRectangle();
            ccwChainData.clockwise = false;
            ccwChainData.shapes = [...ccwChainData.shapes].reverse();
            const ccwChain = new Chain(ccwChainData);

            console.log('\n=== Counter-Clockwise Rectangle Test ===');

            const leadResult = calculateLeads(
                ccwChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log('CCW chain lead normal:', leadResult.leadIn?.normal);

            // For a CCW rectangle, the material avoidance should work the same way
            // The normal should still point outward (away from material)
        });

        it('should test with no cut direction to isolate the default behavior', () => {
            const chain = new Chain(createClockwiseRectangle());

            console.log('\n=== No Cut Direction Test ===');

            const leadResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.NONE, // No cut direction preference
                undefined,
                { x: 1, y: 0 }
            );

            console.log(
                'No cut direction - Lead normal:',
                leadResult.leadIn?.normal
            );

            // With no cut direction, it should default to material avoidance only
            // This will help us see if the cut direction logic is causing the problem
        });
    });
});
