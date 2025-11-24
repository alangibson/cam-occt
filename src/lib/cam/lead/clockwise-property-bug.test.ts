import { describe, expect, it } from 'vitest';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { Chain } from '$lib/cam/chain/classes';

/**
 * Test to verify the bug where offset chains lose the clockwise property,
 * causing incorrect normal direction calculation
 */
describe('Clockwise Property Bug in Offset Chains', () => {
    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to create a horizontal line chain
    function createHorizontalLineChain(clockwise?: boolean): ChainData {
        const shape: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
            layer: 'layer1',
        };

        return {
            id: 'chain1',
            shapes: [shape],
            clockwise,
        };
    }

    // Helper to simulate how offset chains are created (with missing clockwise property)
    function createOffsetChain(originalChain: ChainData): ChainData {
        return {
            id: originalChain.id + '_offset_temp',
            shapes: originalChain.shapes.map((shape) => ({
                ...shape,
                id: shape.id + '-offset',
            })),
            // Note: clockwise property is missing! This is the bug.
        };
    }

    describe('Clockwise property inheritance bug', () => {
        it('should demonstrate that missing clockwise property causes different normal directions', () => {
            // Create original chain with clockwise = false
            const originalChain = createHorizontalLineChain(false);

            // Create offset chain that loses the clockwise property
            const offsetChain = createOffsetChain(originalChain);

            console.log('Original chain clockwise:', originalChain.clockwise);
            console.log('Offset chain clockwise:', offsetChain.clockwise);

            // Calculate leads with same cut direction
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

            console.log(
                'Original chain normal:',
                originalResult.leadIn?.normal
            );
            console.log('Offset chain normal:', offsetResult.leadIn?.normal);

            // These should be the same, but will be different due to the bug
            if (
                originalResult.leadIn &&
                offsetResult.leadIn &&
                originalResult.leadIn.normal &&
                offsetResult.leadIn.normal
            ) {
                // This assertion will likely fail, demonstrating the bug
                try {
                    expect(originalResult.leadIn.normal.x).toBeCloseTo(
                        offsetResult.leadIn.normal.x,
                        6
                    );
                    expect(originalResult.leadIn.normal.y).toBeCloseTo(
                        offsetResult.leadIn.normal.y,
                        6
                    );
                    console.log('✓ Normal directions match - no bug detected');
                } catch (error) {
                    console.log('✗ Normal directions differ - bug confirmed!');
                    console.log(
                        '  Original normal:',
                        originalResult.leadIn?.normal
                    );
                    console.log(
                        '  Offset normal:',
                        offsetResult.leadIn?.normal
                    );
                    throw error;
                }
            }
        });

        it('should show that explicitly setting clockwise property fixes the issue', () => {
            // Create original chain with clockwise = false
            const originalChain = createHorizontalLineChain(false);

            // Create offset chain that preserves the clockwise property
            const offsetChainFixed: ChainData = {
                id: originalChain.id + '_offset_temp',
                shapes: originalChain.shapes.map((shape) => ({
                    ...shape,
                    id: shape.id + '-offset',
                })),
                clockwise: originalChain.clockwise, // Fix: preserve clockwise property
            };

            console.log('Original chain clockwise:', originalChain.clockwise);
            console.log(
                'Fixed offset chain clockwise:',
                offsetChainFixed.clockwise
            );

            // Calculate leads
            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const offsetResultFixed = calculateLeads(
                new Chain(offsetChainFixed),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log(
                'Original chain normal:',
                originalResult.leadIn?.normal
            );
            console.log(
                'Fixed offset chain normal:',
                offsetResultFixed.leadIn?.normal
            );

            // These should now match
            if (
                originalResult.leadIn &&
                offsetResultFixed.leadIn &&
                originalResult.leadIn.normal &&
                offsetResultFixed.leadIn.normal
            ) {
                expect(originalResult.leadIn.normal.x).toBeCloseTo(
                    offsetResultFixed.leadIn.normal.x,
                    6
                );
                expect(originalResult.leadIn.normal.y).toBeCloseTo(
                    offsetResultFixed.leadIn.normal.y,
                    6
                );
                console.log('✓ Normal directions match with fix applied');
            }
        });

        it('should test with clockwise = true to ensure the fix works both ways', () => {
            // Test with clockwise = true
            const originalChain = createHorizontalLineChain(true);

            const offsetChainBroken = createOffsetChain(originalChain);
            const offsetChainFixed: ChainData = {
                ...offsetChainBroken,
                clockwise: originalChain.clockwise,
            };

            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const offsetResultFixed = calculateLeads(
                new Chain(offsetChainFixed),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            if (
                originalResult.leadIn &&
                offsetResultFixed.leadIn &&
                originalResult.leadIn.normal &&
                offsetResultFixed.leadIn.normal
            ) {
                expect(originalResult.leadIn.normal.x).toBeCloseTo(
                    offsetResultFixed.leadIn.normal.x,
                    6
                );
                expect(originalResult.leadIn.normal.y).toBeCloseTo(
                    offsetResultFixed.leadIn.normal.y,
                    6
                );
            }
        });

        it('should test with undefined clockwise property', () => {
            // Test with undefined clockwise (common case)
            const originalChain = createHorizontalLineChain(undefined);

            const offsetChainBroken = createOffsetChain(originalChain);
            const offsetChainFixed: ChainData = {
                ...offsetChainBroken,
                clockwise: originalChain.clockwise, // Should preserve undefined
            };

            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const offsetResultFixed = calculateLeads(
                new Chain(offsetChainFixed),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            if (
                originalResult.leadIn &&
                offsetResultFixed.leadIn &&
                originalResult.leadIn.normal &&
                offsetResultFixed.leadIn.normal
            ) {
                expect(originalResult.leadIn.normal.x).toBeCloseTo(
                    offsetResultFixed.leadIn.normal.x,
                    6
                );
                expect(originalResult.leadIn.normal.y).toBeCloseTo(
                    offsetResultFixed.leadIn.normal.y,
                    6
                );
            }
        });
    });
});
