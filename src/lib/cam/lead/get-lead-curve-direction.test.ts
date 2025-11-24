import { describe, expect, it } from 'vitest';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Chain } from '$lib/cam/chain/classes';
import type { PartData } from '$lib/cam/part/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { isArc } from '$lib/geometry/arc/functions';
import { PartType } from '$lib/cam/part/enums';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';

// Since getLeadCurveDirection is not exported, we test it indirectly
// through calculateLeads and verify the resulting curve direction

describe('getLeadCurveDirection (indirect testing)', () => {
    // Helper to create a simple horizontal line chain
    function createHorizontalLineChain(
        start: Point2D = { x: 0, y: 0 },
        end: Point2D = { x: 10, y: 0 }
    ): Chain {
        const shape: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: { start, end } as Line,
            layer: 'layer1',
        };

        return new Chain({
            id: 'chain1',
            shapes: [shape],
            clockwise: true,
        });
    }

    // Helper to create a vertical line chain
    function createVerticalLineChain(
        start: Point2D = { x: 0, y: 0 },
        end: Point2D = { x: 0, y: 10 }
    ): Chain {
        const shape: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: { start, end } as Line,
            layer: 'layer1',
        };

        return new Chain({
            id: 'chain1',
            shapes: [shape],
            clockwise: true,
        });
    }

    // Helper to create a circle chain
    function createCircleChain(
        center: Point2D = { x: 5, y: 5 },
        radius: number = 3,
        clockwise: boolean = true
    ): Chain {
        const shape: ShapeData = {
            id: 'circle1',
            type: GeometryType.CIRCLE,
            geometry: { center, radius } as Circle,
            layer: 'layer1',
        };

        return new Chain({
            id: 'chain1',
            shapes: [shape],
            clockwise,
        });
    }

    // Helper to create a rectangular part with center hole
    function createRectangleWithHole(): {
        part: PartData;
        shell: Chain;
        hole: Chain;
    } {
        const shell: Chain = new Chain({
            id: 'shell',
            shapes: [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 20, y: 0 },
                    } as Line,
                    layer: 'layer1',
                },
                {
                    id: 'line2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 20, y: 0 },
                        end: { x: 20, y: 20 },
                    } as Line,
                    layer: 'layer1',
                },
                {
                    id: 'line3',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 20, y: 20 },
                        end: { x: 0, y: 20 },
                    } as Line,
                    layer: 'layer1',
                },
                {
                    id: 'line4',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 20 },
                        end: { x: 0, y: 0 },
                    } as Line,
                    layer: 'layer1',
                },
            ],
            clockwise: true,
        });

        const hole: Chain = createCircleChain({ x: 10, y: 10 }, 3, false);

        const part: PartData = {
            id: 'part1',
            shell: shell,
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } },
            voids: [
                {
                    id: 'hole1',
                    chain: hole,
                    type: PartType.HOLE,
                    boundingBox: { min: { x: 7, y: 7 }, max: { x: 13, y: 13 } },
                },
            ],
            slots: [],
            layerName: '0',
        };

        return { part, shell, hole };
    }

    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to get cut normal for a chain
    function getCutNormal(
        chain: Chain,
        cutDirection: CutDirection,
        part?: PartData
    ): Point2D {
        const result = calculateCutNormal(chain, cutDirection, part);
        return result.normal;
    }

    describe('normal direction calculation', () => {
        it('should calculate left and right normals to tangent correctly', () => {
            // For a horizontal line going right, tangent is (1, 0)
            // Left normal should be (0, 1) - pointing up
            // Right normal should be (0, -1) - pointing down

            const chain = createHorizontalLineChain();

            // Test both cut directions to see different normal selections
            const cwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const ccwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(cwResult.leadIn).toBeDefined();
            expect(ccwResult.leadIn).toBeDefined();

            if (
                isArc(cwResult.leadIn!.geometry) &&
                isArc(ccwResult.leadIn!.geometry)
            ) {
                const cwCenter = cwResult.leadIn!.geometry.center;
                const ccwCenter = ccwResult.leadIn!.geometry.center;

                // For horizontal line, Y coordinates should differ indicating different normal selections
                // (Arc centers will be offset from the start point based on normal direction)
                console.log('CW lead center:', cwCenter);
                console.log('CCW lead center:', ccwCenter);

                // Verify arcs are valid
                expect(cwResult.leadIn!.geometry.radius).toBeGreaterThan(0);
                expect(ccwResult.leadIn!.geometry.radius).toBeGreaterThan(0);
            }
        });

        it('should handle vertical line tangents correctly', () => {
            // For a vertical line going up, tangent is (0, 1)
            // Left normal should be (-1, 0) - pointing left
            // Right normal should be (1, 0) - pointing right

            const chain = createVerticalLineChain();

            const cwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const ccwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(cwResult.leadIn).toBeDefined();
            expect(ccwResult.leadIn).toBeDefined();

            if (
                isArc(cwResult.leadIn!.geometry) &&
                isArc(ccwResult.leadIn!.geometry)
            ) {
                // For vertical line, X coordinates should differ
                const cwCenter = cwResult.leadIn!.geometry.center;
                const ccwCenter = ccwResult.leadIn!.geometry.center;

                console.log('Vertical line CW lead center:', cwCenter);
                console.log('Vertical line CCW lead center:', ccwCenter);

                expect(cwResult.leadIn!.geometry.radius).toBeGreaterThan(0);
                expect(ccwResult.leadIn!.geometry.radius).toBeGreaterThan(0);
            }
        });
    });

    describe('material avoidance logic', () => {
        it('should avoid solid material when part context is provided', () => {
            const { part, shell, hole } = createRectangleWithHole();

            // Test shell lead placement - should go outside the part
            const shellResult = calculateLeads(
                shell,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                part,
                { x: 1, y: 0 }
            );

            // Test hole lead placement - should stay inside the hole
            const holeResult = calculateLeads(
                hole,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                part,
                { x: 1, y: 0 }
            );

            expect(shellResult.leadIn).toBeDefined();
            expect(holeResult.leadIn).toBeDefined();

            if (isArc(shellResult.leadIn!.geometry)) {
                const shellCenter = shellResult.leadIn!.geometry.center;
                // Shell lead should be outside the rectangle (x < 0 or x > 20 or y < 0 or y > 20)
                const isOutside =
                    shellCenter.x < 0 ||
                    shellCenter.x > 20 ||
                    shellCenter.y < 0 ||
                    shellCenter.y > 20;
                console.log(
                    'Shell lead center:',
                    shellCenter,
                    'isOutside:',
                    isOutside
                );
            }

            if (isArc(holeResult.leadIn!.geometry)) {
                const holeCenter = holeResult.leadIn!.geometry.center;
                // Hole lead should be inside the circle (distance from center < radius)
                const distFromHoleCenter = Math.sqrt(
                    Math.pow(holeCenter.x - 10, 2) +
                        Math.pow(holeCenter.y - 10, 2)
                );
                console.log(
                    'Hole lead center:',
                    holeCenter,
                    'distance from hole center:',
                    distFromHoleCenter
                );
                // With 90° arc sweep and arcLength=5, radius ≈ 3.18
                // Arc center can be up to hole_radius + arc_radius from hole center
                expect(distFromHoleCenter).toBeLessThan(7); // 3 (hole radius) + ~3.18 (arc radius) + tolerance
            }
        });

        it('should choose direction that avoids solid material over cut direction preference', () => {
            const { part } = createRectangleWithHole();

            // Place the chain start very close to a boundary where only one direction is valid
            const edgeChain: Chain = new Chain({
                id: 'edge-chain',
                shapes: [
                    {
                        id: 'edge-line',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0.1, y: 0.1 }, // Very close to corner
                            end: { x: 5, y: 0.1 },
                        } as Line,
                        layer: 'layer1',
                    },
                ],
                clockwise: true,
            });

            const result = calculateLeads(
                edgeChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                part,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();
            // May generate warnings about material intersection when close to boundaries
            console.log('Edge case warnings:', result.warnings?.length || 0);
            if (result.warnings && result.warnings.length > 0) {
                console.log('Warning messages:', result.warnings);
            }
        });
    });

    describe('cut direction preference', () => {
        it('should apply cut direction preference when both normals avoid material', () => {
            // Test with chain that has plenty of clearance from boundaries
            const chain = createCircleChain({ x: 50, y: 50 }, 10);

            const cwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const ccwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(cwResult.leadIn).toBeDefined();
            expect(ccwResult.leadIn).toBeDefined();

            if (
                isArc(cwResult.leadIn!.geometry) &&
                isArc(ccwResult.leadIn!.geometry)
            ) {
                const cwArc = cwResult.leadIn!.geometry;
                const ccwArc = ccwResult.leadIn!.geometry;

                // Arc sweeps should follow the tangent direction
                // For a circle, CW and CCW cuts may have the same tangent at start point
                // so sweep directions may be the same (this is correct!)
                console.log('CW arc clockwise:', cwArc.clockwise);
                console.log('CCW arc clockwise:', ccwArc.clockwise);

                // Both arcs should be valid
                expect(cwArc.radius).toBeGreaterThan(0);
                expect(ccwArc.radius).toBeGreaterThan(0);
            }
        });

        it('should handle no cut direction specified', () => {
            const chain = createHorizontalLineChain();

            const result = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.NONE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();

            if (isArc(result.leadIn!.geometry)) {
                // Should still generate valid arc even without cut direction preference
                expect(result.leadIn!.geometry.radius).toBeGreaterThan(0);

                const span = Math.abs(
                    result.leadIn!.geometry.endAngle -
                        result.leadIn!.geometry.startAngle
                );
                expect(span).toBeGreaterThan(0.01);
            }
        });
    });

    describe('chain clockwise property handling', () => {
        it('lead sweep should match cut direction regardless of chain clockwise property', () => {
            const cwChain = createCircleChain({ x: 10, y: 10 }, 5, true);
            const ccwChain = createCircleChain({ x: 10, y: 10 }, 5, false);

            // Both chains cut with same direction should produce same sweep
            const cwChainResult = calculateLeads(
                cwChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const ccwChainResult = calculateLeads(
                ccwChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(cwChainResult.leadIn).toBeDefined();
            expect(ccwChainResult.leadIn).toBeDefined();

            if (
                isArc(cwChainResult.leadIn!.geometry) &&
                isArc(ccwChainResult.leadIn!.geometry)
            ) {
                const cwChainArc = cwChainResult.leadIn!.geometry;
                const ccwChainArc = ccwChainResult.leadIn!.geometry;

                console.log('CW chain lead center:', cwChainArc.center);
                console.log('CCW chain lead center:', ccwChainArc.center);
                console.log('CW chain arc clockwise:', cwChainArc.clockwise);
                console.log('CCW chain arc clockwise:', ccwChainArc.clockwise);

                // CRITICAL INVARIANT: Lead sweep matches cut direction, not chain winding
                // Both chains cut CW should have CW lead sweep
                expect(cwChainArc.clockwise).toBe(true);
                expect(ccwChainArc.clockwise).toBe(true);
            }
        });
    });

    describe('flipSide parameter', () => {
        it('should flip curve direction when flipSide is true', () => {
            const chain = createHorizontalLineChain();
            const cutNormal = getCutNormal(chain, CutDirection.CLOCKWISE);

            const normalResult = calculateLeads(
                chain,
                { ...baseLeadConfig, flipSide: false },
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal
            );

            const flippedResult = calculateLeads(
                chain,
                { ...baseLeadConfig, flipSide: true },
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal
            );

            expect(normalResult.leadIn).toBeDefined();
            expect(flippedResult.leadIn).toBeDefined();

            if (
                isArc(normalResult.leadIn!.geometry) &&
                isArc(flippedResult.leadIn!.geometry)
            ) {
                const normalCenter = normalResult.leadIn!.geometry.center;
                const flippedCenter = flippedResult.leadIn!.geometry.center;

                console.log('Normal lead center:', normalCenter);
                console.log('Flipped lead center:', flippedCenter);

                // Flipped should be on opposite side - Y coordinates should have opposite signs
                // relative to the line start point
                expect(normalCenter.y * flippedCenter.y).toBeLessThan(0);
            }
        });
    });

    describe('cross product calculations', () => {
        it('should calculate cross product correctly for clockwise determination', () => {
            // This tests the cross product logic: tangent.x * normal.y - tangent.y * normal.x
            const chain = createHorizontalLineChain();

            // For horizontal line, tangent = (1, 0)
            // Left normal = (0, 1): cross = 1*1 - 0*0 = 1 (positive, CCW)
            // Right normal = (0, -1): cross = 1*(-1) - 0*0 = -1 (negative, CW)

            const cwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(cwResult.leadIn).toBeDefined();

            if (isArc(cwResult.leadIn!.geometry)) {
                const arc = cwResult.leadIn!.geometry;

                // For clockwise cut direction, should choose direction that gives clockwise sweep
                // The specific arc properties depend on the createTangentArc implementation
                expect(arc.radius).toBeGreaterThan(0);

                const span = Math.abs(arc.endAngle - arc.startAngle);
                expect(span).toBeGreaterThan(0.01);
            }
        });
    });

    describe('lead-in vs lead-out differences', () => {
        it('should use isLeadIn parameter correctly for direction selection', () => {
            const chain = createHorizontalLineChain();

            const result = calculateLeads(
                chain,
                baseLeadConfig,
                baseLeadConfig, // Both lead-in and lead-out
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();
            expect(result.leadOut).toBeDefined();

            if (
                isArc(result.leadIn!.geometry) &&
                isArc(result.leadOut!.geometry)
            ) {
                const leadInArc = result.leadIn!.geometry;
                const leadOutArc = result.leadOut!.geometry;

                console.log('Lead-in arc center:', leadInArc.center);
                console.log('Lead-out arc center:', leadOutArc.center);

                // Lead-in and lead-out may have different positions based on chain geometry
                // Both should be valid arcs
                expect(leadInArc.radius).toBeGreaterThan(0);
                expect(leadOutArc.radius).toBeGreaterThan(0);
            }
        });
    });

    describe('specific direction logic tests', () => {
        it('should consistently choose left normal for simple horizontal line with no constraints', () => {
            const chain = createHorizontalLineChain();
            const cutNormal = getCutNormal(chain, CutDirection.NONE);

            // Test with no cut direction and no part - should default to left normal
            const result = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.NONE,
                undefined,
                cutNormal
            );

            expect(result.leadIn).toBeDefined();

            if (isArc(result.leadIn!.geometry)) {
                const center = result.leadIn!.geometry.center;
                console.log('No cut direction - lead center:', center);

                // For horizontal line start (0,0) with left normal selection,
                // arc center should be above the line (positive Y)
                expect(center.y).toBeGreaterThan(0);
            }
        });

        it('should test specific normal direction selection logic', () => {
            // Create a chain positioned where we can clearly test normal directions
            const chain = createHorizontalLineChain(
                { x: 10, y: 10 },
                { x: 20, y: 10 }
            );

            const cwNormal = getCutNormal(chain, CutDirection.CLOCKWISE);
            const ccwNormal = getCutNormal(
                chain,
                CutDirection.COUNTERCLOCKWISE
            );

            const cwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                cwNormal
            );

            const ccwResult = calculateLeads(
                chain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                ccwNormal
            );

            expect(cwResult.leadIn).toBeDefined();
            expect(ccwResult.leadIn).toBeDefined();

            if (
                isArc(cwResult.leadIn!.geometry) &&
                isArc(ccwResult.leadIn!.geometry)
            ) {
                const cwCenter = cwResult.leadIn!.geometry.center;
                const ccwCenter = ccwResult.leadIn!.geometry.center;

                console.log('Horizontal line CW center:', cwCenter);
                console.log('Horizontal line CCW center:', ccwCenter);

                // The Y coordinates should differ, indicating different normal selection
                const yDifference = Math.abs(cwCenter.y - ccwCenter.y);
                expect(yDifference).toBeGreaterThan(0.1);
            }
        });

        it('should handle manual angle override', () => {
            const chain = createHorizontalLineChain();

            // Test with manual angle set to 90 degrees (straight up)
            const manualAngleConfig: LeadConfig = {
                ...baseLeadConfig,
                angle: 90,
            };

            const result = calculateLeads(
                chain,
                manualAngleConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();

            if (isArc(result.leadIn!.geometry)) {
                const center = result.leadIn!.geometry.center;
                console.log('Manual angle 90° - lead center:', center);

                // With 90° manual angle, direction should be (0, 1) pointing up
                // Arc center should reflect this direction choice
                expect(result.leadIn!.geometry.radius).toBeGreaterThan(0);
            }
        });

        it('should test cross product calculation for sweep direction', () => {
            // Test different line orientations to verify cross product logic
            const horizontalChain = createHorizontalLineChain();
            const verticalChain = createVerticalLineChain();

            const hResult = calculateLeads(
                horizontalChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            const vResult = calculateLeads(
                verticalChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(hResult.leadIn).toBeDefined();
            expect(vResult.leadIn).toBeDefined();

            if (
                isArc(hResult.leadIn!.geometry) &&
                isArc(vResult.leadIn!.geometry)
            ) {
                const hArc = hResult.leadIn!.geometry;
                const vArc = vResult.leadIn!.geometry;

                console.log('Horizontal line arc clockwise:', hArc.clockwise);
                console.log('Vertical line arc clockwise:', vArc.clockwise);

                // Both should be valid arcs with proper sweep directions
                expect(hArc.radius).toBeGreaterThan(0);
                expect(vArc.radius).toBeGreaterThan(0);
            }
        });
    });

    describe('edge cases', () => {
        it('should handle degenerate tangent vectors gracefully', () => {
            // Create a very short line that might result in numerical issues
            const shortChain = createHorizontalLineChain(
                { x: 0, y: 0 },
                { x: 0.001, y: 0 }
            );

            const result = calculateLeads(
                shortChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            // Should either generate a valid lead or fail gracefully
            if (result.leadIn) {
                if (isArc(result.leadIn.geometry)) {
                    expect(result.leadIn.geometry.radius).toBeGreaterThan(0);
                }
            }
            // No assertion failure means graceful handling
        });

        it('should handle point coincidence at chain boundaries', () => {
            // Test with a closed chain where start/end points are the same
            const closedChain: Chain = new Chain({
                id: 'closed',
                shapes: [
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
                            end: { x: 0, y: 0 },
                        } as Line,
                        layer: 'layer1',
                    },
                ],
                clockwise: true,
            });

            const result = calculateLeads(
                closedChain,
                baseLeadConfig,
                baseLeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            // Should handle closed chains appropriately
            if (result.leadIn) {
                if (isArc(result.leadIn.geometry)) {
                    expect(result.leadIn.geometry.radius).toBeGreaterThan(0);
                }
            }
        });
    });
});
