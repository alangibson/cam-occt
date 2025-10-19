import { describe, expect, it } from 'vitest';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { getArcStartPoint, getArcEndPoint } from '$lib/geometry/arc/functions';
import {
    getChainTangent,
    getChainStartPoint,
} from '$lib/geometry/chain/functions';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { Part } from '$lib/cam/part/interfaces';
import { PartType } from '$lib/cam/part/enums';

/**
 * CRITICAL INVARIANT TESTS
 *
 * Lead arcs MUST sweep in the tangent direction of the cut.
 * - Lead-in: sweeps FROM start point TOWARD cut direction
 * - Lead-out: sweeps FROM end point ALONG cut direction
 *
 * This must hold for ALL cases regardless of:
 * - Shell vs hole
 * - CW vs CCW cut direction
 * - Offset type (OUTSET, INSET, NONE)
 */

describe('Lead Tangent Following Invariant', () => {
    function createCircleChain(
        center = { x: 100, y: 100 },
        radius = 50,
        clockwise = true
    ): Chain {
        return {
            id: 'circle-chain',
            shapes: [
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center,
                        radius,
                    } as Circle,
                },
            ],
            clockwise,
        };
    }

    function createRectangleWithHole(): {
        part: Part;
        shell: Chain;
        hole: Chain;
    } {
        const shell: Chain = {
            id: 'shell',
            shapes: [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 200, y: 0 },
                    } as Line,
                },
                {
                    id: 'line2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 200, y: 0 },
                        end: { x: 200, y: 200 },
                    } as Line,
                },
                {
                    id: 'line3',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 200, y: 200 },
                        end: { x: 0, y: 200 },
                    } as Line,
                },
                {
                    id: 'line4',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 200 },
                        end: { x: 0, y: 0 },
                    } as Line,
                },
            ],
            clockwise: true,
        };

        const hole: Chain = createCircleChain({ x: 100, y: 100 }, 30, false);

        const part: Part = {
            id: 'part1',
            shell: shell,
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 200, y: 200 } },
            voids: [
                {
                    id: 'hole1',
                    chain: hole,
                    type: PartType.HOLE,
                    boundingBox: {
                        min: { x: 70, y: 70 },
                        max: { x: 130, y: 130 },
                    },
                },
            ],
            slots: [],
        };

        return { part, shell, hole };
    }

    const leadConfig = {
        type: LeadType.ARC,
        length: 20,
        flipSide: false,
        fit: false,
        angle: 0, // Use automatic mode
    };

    /**
     * Helper to determine if an arc sweeps in the direction of a tangent vector.
     *
     * For a lead-in arc:
     * - Arc end is at connection point
     * - Arc should sweep such that velocity at end matches cut tangent
     *
     * For a lead-out arc:
     * - Arc start is at connection point
     * - Arc should sweep such that velocity at start matches cut tangent
     */
    function doesArcFollowTangent(
        arc: Arc,
        tangent: { x: number; y: number },
        isLeadIn: boolean
    ): boolean {
        // Get the velocity direction at the connection point
        const connectionPoint = isLeadIn
            ? getArcEndPoint(arc)
            : getArcStartPoint(arc);

        // For an arc, the velocity at any point is perpendicular to the radius at that point
        const radiusToConnection = {
            x: connectionPoint.x - arc.center.x,
            y: connectionPoint.y - arc.center.y,
        };

        // Velocity is perpendicular to radius
        // For CW arc (clockwise=true), velocity is 90° CW from radius
        // For CCW arc (clockwise=false), velocity is 90° CCW from radius
        const velocity = arc.clockwise
            ? { x: radiusToConnection.y, y: -radiusToConnection.x } // 90° CW
            : { x: -radiusToConnection.y, y: radiusToConnection.x }; // 90° CCW

        // Normalize both vectors for comparison
        const velLength = Math.sqrt(
            velocity.x * velocity.x + velocity.y * velocity.y
        );
        const tangentLength = Math.sqrt(
            tangent.x * tangent.x + tangent.y * tangent.y
        );

        const velNorm = {
            x: velocity.x / velLength,
            y: velocity.y / velLength,
        };
        const tangentNorm = {
            x: tangent.x / tangentLength,
            y: tangent.y / tangentLength,
        };

        // Check if velocity and tangent point in the same direction (dot product > 0.9)
        const dot = velNorm.x * tangentNorm.x + velNorm.y * tangentNorm.y;

        return dot > 0.9; // Allow small tolerance
    }

    describe('Standalone Circle Chains', () => {
        it('CW cut should have lead that follows tangent', () => {
            const chain = createCircleChain({ x: 100, y: 100 }, 50, true);
            const cutNormal = calculateCutNormal(
                chain,
                CutDirection.CLOCKWISE,
                undefined
            );

            const result = calculateLeads(
                chain,
                leadConfig,
                leadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            // Get tangent at connection point
            const connectionPoint = getChainStartPoint(chain)!;
            const tangent = getChainTangent(chain, connectionPoint, true);

            // Verify arc follows tangent
            const follows = doesArcFollowTangent(arc, tangent, true);
            if (!follows) {
                console.log('Arc clockwise:', arc.clockwise);
                console.log('Tangent:', tangent);
                console.log('Connection:', connectionPoint);
            }
            expect(follows).toBe(true);
        });

        it('CCW cut should have lead that follows tangent', () => {
            const chain = createCircleChain({ x: 100, y: 100 }, 50, true);
            const cutNormal = calculateCutNormal(
                chain,
                CutDirection.COUNTERCLOCKWISE,
                undefined
            );

            const result = calculateLeads(
                chain,
                leadConfig,
                leadConfig,
                CutDirection.COUNTERCLOCKWISE,
                undefined,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(chain)!;
            const tangent = getChainTangent(chain, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            if (!follows) {
                console.log('Arc clockwise:', arc.clockwise);
                console.log('Tangent:', tangent);
                console.log('Connection:', connectionPoint);
            }
            expect(follows).toBe(true);
        });
    });

    describe('Shell Chains', () => {
        it('Shell with CW cut and NO offset should follow tangent', () => {
            const { part, shell } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                shell,
                CutDirection.CLOCKWISE,
                part
            );

            const result = calculateLeads(
                shell,
                leadConfig,
                leadConfig,
                CutDirection.CLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(shell)!;
            const tangent = getChainTangent(shell, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });

        it('Shell with CW cut and OUTSET offset should follow tangent', () => {
            const { part, shell } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                shell,
                CutDirection.CLOCKWISE,
                part,
                OffsetDirection.OUTSET
            );

            const result = calculateLeads(
                shell,
                leadConfig,
                leadConfig,
                CutDirection.CLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(shell)!;
            const tangent = getChainTangent(shell, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });

        it('Shell with CCW cut and NO offset should follow tangent', () => {
            const { part, shell } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                shell,
                CutDirection.COUNTERCLOCKWISE,
                part
            );

            const result = calculateLeads(
                shell,
                leadConfig,
                leadConfig,
                CutDirection.COUNTERCLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(shell)!;
            const tangent = getChainTangent(shell, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });

        it('Shell with CCW cut and OUTSET offset should follow tangent', () => {
            const { part, shell } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                shell,
                CutDirection.COUNTERCLOCKWISE,
                part,
                OffsetDirection.OUTSET
            );

            const result = calculateLeads(
                shell,
                leadConfig,
                leadConfig,
                CutDirection.COUNTERCLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(shell)!;
            const tangent = getChainTangent(shell, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });
    });

    describe('Hole Chains', () => {
        it('Hole with CW cut and NO offset should follow tangent', () => {
            const { part, hole } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                hole,
                CutDirection.CLOCKWISE,
                part
            );

            const result = calculateLeads(
                hole,
                leadConfig,
                leadConfig,
                CutDirection.CLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(hole)!;
            const tangent = getChainTangent(hole, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });

        it('Hole with CW cut and OUTSET offset should follow tangent', () => {
            const { part, hole } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                hole,
                CutDirection.CLOCKWISE,
                part,
                OffsetDirection.OUTSET
            );

            const result = calculateLeads(
                hole,
                leadConfig,
                leadConfig,
                CutDirection.CLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(hole)!;
            const tangent = getChainTangent(hole, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });

        it('Hole with CCW cut and NO offset should follow tangent', () => {
            const { part, hole } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                hole,
                CutDirection.COUNTERCLOCKWISE,
                part
            );

            const result = calculateLeads(
                hole,
                leadConfig,
                leadConfig,
                CutDirection.COUNTERCLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(hole)!;
            const tangent = getChainTangent(hole, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });

        it('Hole with CCW cut and OUTSET offset should follow tangent', () => {
            const { part, hole } = createRectangleWithHole();
            const cutNormal = calculateCutNormal(
                hole,
                CutDirection.COUNTERCLOCKWISE,
                part,
                OffsetDirection.OUTSET
            );

            const result = calculateLeads(
                hole,
                leadConfig,
                leadConfig,
                CutDirection.COUNTERCLOCKWISE,
                part,
                cutNormal.normal
            );

            expect(result.leadIn).toBeDefined();
            const arc = result.leadIn!.geometry as Arc;

            const connectionPoint = getChainStartPoint(hole)!;
            const tangent = getChainTangent(hole, connectionPoint, true);

            const follows = doesArcFollowTangent(arc, tangent, true);
            expect(follows).toBe(true);
        });
    });

    describe('Lead-out', () => {
        it('Lead-out should also follow tangent direction', () => {
            const chain = createCircleChain({ x: 100, y: 100 }, 50, true);
            const cutNormal = calculateCutNormal(
                chain,
                CutDirection.CLOCKWISE,
                undefined
            );

            const result = calculateLeads(
                chain,
                leadConfig,
                leadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal.normal
            );

            expect(result.leadOut).toBeDefined();
            const arc = result.leadOut!.geometry as Arc;

            // For closed chains, end point = start point
            const connectionPoint = getChainStartPoint(chain)!;
            const tangent = getChainTangent(chain, connectionPoint, false); // false for lead-out

            const follows = doesArcFollowTangent(arc, tangent, false);
            expect(follows).toBe(true);
        });
    });
});
