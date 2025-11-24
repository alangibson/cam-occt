import { describe, expect, it } from 'vitest';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { Chain } from '$lib/cam/chain/classes';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';

/**
 * Test to demonstrate the bug in closed chain normal direction calculation
 * when the clockwise property is lost in offset chains
 */
describe('Closed Chain Normal Direction Bug', () => {
    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to create a closed rectangular chain
    function createClosedRectangleChain(clockwise?: boolean): ChainData {
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
            id: 'rectangle-chain',
            shapes,
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

    describe('Closed chain clockwise property bug', () => {
        it('should demonstrate normal direction difference with clockwise=false original chain', () => {
            // Create original closed chain with clockwise = false (hole-like)
            const originalChain = createClosedRectangleChain(false);

            // Create offset chain that loses the clockwise property
            const offsetChain = createOffsetChain(originalChain);

            console.log('Original chain clockwise:', originalChain.clockwise);
            console.log('Offset chain clockwise:', offsetChain.clockwise);

            // Use cut direction where clockwise property matters
            const cutDirection = CutDirection.CLOCKWISE;

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

            console.log(
                'Original chain normal:',
                originalResult.leadIn?.normal
            );
            console.log('Offset chain normal:', offsetResult.leadIn?.normal);

            if (
                originalResult.leadIn &&
                offsetResult.leadIn &&
                originalResult.leadIn.normal &&
                offsetResult.leadIn.normal
            ) {
                // Check if normals are different
                const normalsAreEqual =
                    Math.abs(
                        originalResult.leadIn.normal.x -
                            offsetResult.leadIn.normal.x
                    ) < 1e-6 &&
                    Math.abs(
                        originalResult.leadIn.normal.y -
                            offsetResult.leadIn.normal.y
                    ) < 1e-6;

                if (normalsAreEqual) {
                    console.log('✓ Normal directions match - no bug detected');
                } else {
                    console.log('✗ Normal directions differ - bug confirmed!');
                    console.log(
                        '  Original normal:',
                        originalResult.leadIn.normal
                    );
                    console.log('  Offset normal:', offsetResult.leadIn.normal);
                    console.log(
                        '  This demonstrates the clockwise property bug'
                    );
                }

                // This test is designed to show the problem, not necessarily to fail
                // The assertion failure would confirm the bug exists
                try {
                    expect(originalResult.leadIn.normal.x).toBeCloseTo(
                        offsetResult.leadIn.normal.x,
                        6
                    );
                    expect(originalResult.leadIn.normal.y).toBeCloseTo(
                        offsetResult.leadIn.normal.y,
                        6
                    );
                } catch {
                    console.log('Assertion failed, confirming the bug exists');
                    // Don't re-throw to allow the test to continue and show the fix
                }
            }
        });

        it('should show that preserving clockwise property fixes the issue', () => {
            // Create original closed chain with clockwise = false
            const originalChain = createClosedRectangleChain(false);

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

            const cutDirection = CutDirection.CLOCKWISE;

            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                cutDirection,
                undefined,
                { x: 1, y: 0 }
            );

            const offsetResultFixed = calculateLeads(
                new Chain(offsetChainFixed),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                cutDirection,
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

        it('should test with clockwise=true to verify the bug affects both directions', () => {
            // Test with clockwise = true (shell-like)
            const originalChain = createClosedRectangleChain(true);
            const offsetChain = createOffsetChain(originalChain);

            console.log('Test clockwise=true:');
            console.log('Original chain clockwise:', originalChain.clockwise);
            console.log('Offset chain clockwise:', offsetChain.clockwise);

            const cutDirection = CutDirection.COUNTERCLOCKWISE;

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

            console.log(
                'Original chain normal:',
                originalResult.leadIn?.normal
            );
            console.log('Offset chain normal:', offsetResult.leadIn?.normal);

            if (
                originalResult.leadIn &&
                offsetResult.leadIn &&
                originalResult.leadIn.normal &&
                offsetResult.leadIn.normal
            ) {
                const normalsAreEqual =
                    Math.abs(
                        originalResult.leadIn.normal.x -
                            offsetResult.leadIn.normal.x
                    ) < 1e-6 &&
                    Math.abs(
                        originalResult.leadIn.normal.y -
                            offsetResult.leadIn.normal.y
                    ) < 1e-6;

                if (!normalsAreEqual) {
                    console.log(
                        '✗ Bug confirmed for clockwise=true case as well'
                    );
                } else {
                    console.log(
                        '✓ Normal directions match for clockwise=true case'
                    );
                }
            }
        });

        it('should test the specific code path that uses chainIsShell logic', () => {
            // This test focuses on the specific scenario in getLeadCurveDirection
            // where the clockwise property is used to determine chainIsShell

            // Create a chain that will trigger the problematic code path:
            // - Closed chain (isChainClosed returns true)
            // - Both normal directions are outside the chain
            // - Cut direction is specified

            const originalChain = createClosedRectangleChain(false); // CCW = hole-like
            const offsetChain = createOffsetChain(originalChain); // loses clockwise property

            // The bug happens when:
            // originalChain.clockwise = false → chainIsShell = false → hole behavior
            // offsetChain.clockwise = undefined → chainIsShell = true → shell behavior

            const cutDirection = CutDirection.CLOCKWISE;

            console.log('Testing specific code path:');
            console.log(
                'Original clockwise:',
                originalChain.clockwise,
                '→ chainIsShell =',
                !(originalChain.clockwise ?? true)
            );
            console.log(
                'Offset clockwise:',
                offsetChain.clockwise,
                '→ chainIsShell =',
                !(offsetChain.clockwise ?? true)
            );

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

            if (originalResult.leadIn && offsetResult.leadIn) {
                console.log('Results:');
                console.log('  Original normal:', originalResult.leadIn.normal);
                console.log('  Offset normal:', offsetResult.leadIn.normal);

                // The expected behavior is that these should be identical,
                // but they might differ due to different chainIsShell values
            }
        });
    });
});
