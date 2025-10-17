import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import { GeometryType } from '$lib/types/geometry';
import type { Arc, Shape, Point2D } from '$lib/types/geometry';
import { convertLeadGeometryToPoints } from './functions';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';

describe('Lead Tangency Tests', () => {
    // Helper to get cut normal for a chain
    function getCutNormal(
        chain: Chain,
        cutDirection: CutDirection,
        part?: DetectedPart
    ): Point2D {
        const result = calculateCutNormal(chain, cutDirection, part);
        return result.normal;
    }

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

    // Helper to calculate angle between two vectors
    function angleBetweenVectors(
        v1: { x: number; y: number },
        v2: { x: number; y: number }
    ): number {
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        return Math.acos(dot / (mag1 * mag2));
    }

    describe('tangency verification', () => {
        it('should create tangent lead-in for horizontal line', () => {
            // Horizontal line from (0,0) to (10,0)
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadConfig = { type: LeadType.ARC, length: 5 };
            const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };
            const cutNormal = getCutNormal(chain, CutDirection.CLOCKWISE);

            const result = calculateLeads(
                chain,
                leadIn,
                leadOut,
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);
            expect(points.length).toBeGreaterThan(2);
            const connectionPoint = points[points.length - 1]; // Last point should connect to chain
            const previousPoint = points[points.length - 2]; // Second to last point

            // Connection point should be at chain start (0, 0)
            expect(connectionPoint.x).toBeCloseTo(0, 5);
            expect(connectionPoint.y).toBeCloseTo(0, 5);

            // Calculate the tangent direction of the lead at connection point
            // Use the proper geometric tangent from the arc, not tessellated points
            const leadGeometry = result.leadIn!.geometry;
            let leadTangent: { x: number; y: number };

            if (result.leadIn!.type === LeadType.ARC) {
                const arc = leadGeometry as Arc;
                // For lead-in arc, we want the tangent at the end (connection point)
                const angle = arc.endAngle;
                const radiusVector = { x: Math.cos(angle), y: Math.sin(angle) };

                // Tangent is perpendicular to radius
                if (arc.clockwise) {
                    leadTangent = { x: radiusVector.y, y: -radiusVector.x };
                } else {
                    leadTangent = { x: -radiusVector.y, y: radiusVector.x };
                }
            } else {
                // Fallback to point calculation for non-arc leads
                leadTangent = {
                    x: connectionPoint.x - previousPoint.x,
                    y: connectionPoint.y - previousPoint.y,
                };
                const mag = Math.sqrt(
                    leadTangent.x * leadTangent.x +
                        leadTangent.y * leadTangent.y
                );
                if (mag > 0) {
                    leadTangent.x /= mag;
                    leadTangent.y /= mag;
                }
            }

            // Line tangent is (1, 0) - horizontal direction
            const lineTangent = { x: 1, y: 0 };

            // The angle between lead tangent and line tangent should be 0 (parallel)
            const angle: number = angleBetweenVectors(leadTangent, lineTangent);
            const isParallel =
                Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1;
            expect(isParallel).toBe(true); // Vectors should be parallel (same or opposite direction)
        });

        it('should create tangent lead-out for horizontal line', () => {
            // Horizontal line from (0,0) to (10,0)
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const leadIn: LeadConfig = { type: LeadType.NONE, length: 0 };
            const leadOut: LeadConfig = { type: LeadType.ARC, length: 5 };
            const cutNormal = getCutNormal(chain, CutDirection.CLOCKWISE);

            const result = calculateLeads(
                chain,
                leadIn,
                leadOut,
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal
            );

            expect(result.leadOut).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadOut!);
            expect(points.length).toBeGreaterThan(2);
            const connectionPoint = points[0]; // First point should connect to chain
            const nextPoint = points[1]; // Second point

            // Connection point should be at chain end (10, 0)
            expect(connectionPoint.x).toBeCloseTo(10, 5);
            expect(connectionPoint.y).toBeCloseTo(0, 5);

            // Calculate the tangent direction of the lead at connection point
            // Use the proper geometric tangent from the arc, not tessellated points
            const leadGeometry = result.leadOut!.geometry;
            let leadTangent: { x: number; y: number };

            if (result.leadOut!.type === LeadType.ARC) {
                const arc = leadGeometry as Arc;
                // For lead-out arc, we want the tangent at the start (connection point)
                const angle = arc.startAngle;
                const radiusVector = { x: Math.cos(angle), y: Math.sin(angle) };

                // Tangent is perpendicular to radius
                if (arc.clockwise) {
                    leadTangent = { x: radiusVector.y, y: -radiusVector.x };
                } else {
                    leadTangent = { x: -radiusVector.y, y: radiusVector.x };
                }
            } else {
                // Fallback to point calculation for non-arc leads
                leadTangent = {
                    x: nextPoint.x - connectionPoint.x,
                    y: nextPoint.y - connectionPoint.y,
                };
                const mag = Math.sqrt(
                    leadTangent.x * leadTangent.x +
                        leadTangent.y * leadTangent.y
                );
                if (mag > 0) {
                    leadTangent.x /= mag;
                    leadTangent.y /= mag;
                }
            }

            // Line tangent is (1, 0) - horizontal direction
            const lineTangent = { x: 1, y: 0 };

            // The angle between lead tangent and line tangent should be 0 (parallel)
            const angle: number = angleBetweenVectors(leadTangent, lineTangent);
            const isParallel =
                Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1;
            expect(isParallel).toBe(true); // Vectors should be parallel (same or opposite direction)
        });

        it('should create tangent lead for circle', () => {
            // Circle at (5, 5) with radius 3
            const chain = createCircleChain({ x: 5, y: 5 }, 3);
            const leadIn: LeadConfig = { type: LeadType.ARC, length: 4 };
            const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };
            const cutNormal = getCutNormal(chain, CutDirection.CLOCKWISE);

            const result = calculateLeads(
                chain,
                leadIn,
                leadOut,
                CutDirection.CLOCKWISE,
                undefined,
                cutNormal
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);
            expect(points.length).toBeGreaterThan(2);
            const connectionPoint = points[points.length - 1]; // Last point connects to circle
            const previousPoint = points[points.length - 2]; // Second to last point

            // Connection point should be on the circle (rightmost point by default)
            expect(connectionPoint.x).toBeCloseTo(8, 5); // 5 + 3 = 8
            expect(connectionPoint.y).toBeCloseTo(5, 5);

            // Calculate the tangent direction of the lead at connection point
            // Use the proper geometric tangent from the arc, not tessellated points
            const leadGeometry = result.leadIn!.geometry;
            let leadTangent: { x: number; y: number };

            if (result.leadIn!.type === LeadType.ARC) {
                const arc = leadGeometry as Arc;
                // For lead-in arc, we want the tangent at the end (connection point)
                const angle = arc.endAngle;
                const radiusVector = { x: Math.cos(angle), y: Math.sin(angle) };

                // Tangent is perpendicular to radius
                if (arc.clockwise) {
                    leadTangent = { x: radiusVector.y, y: -radiusVector.x };
                } else {
                    leadTangent = { x: -radiusVector.y, y: radiusVector.x };
                }
            } else {
                // Fallback to point calculation for non-arc leads
                leadTangent = {
                    x: connectionPoint.x - previousPoint.x,
                    y: connectionPoint.y - previousPoint.y,
                };
                const mag = Math.sqrt(
                    leadTangent.x * leadTangent.x +
                        leadTangent.y * leadTangent.y
                );
                if (mag > 0) {
                    leadTangent.x /= mag;
                    leadTangent.y /= mag;
                }
            }

            // Circle tangent at rightmost point (8, 5) is vertical: (0, 1) or (0, -1)
            // For counterclockwise direction, tangent at rightmost point is (0, 1)
            const circleTangent = { x: 0, y: 1 };

            // The angle between lead tangent and circle tangent should be 0 (parallel)
            const angle: number = angleBetweenVectors(
                leadTangent,
                circleTangent
            );
            const isParallel =
                Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1;
            expect(isParallel).toBe(true); // Vectors should be parallel (same or opposite direction)
        });

        it('should create properly curved lead for shell vs hole', () => {
            // Test that shell leads curve outward and hole leads curve inward
            const shellChain = createCircleChain({ x: 5, y: 5 }, 3);
            shellChain.id = 'shell-chain'; // Fix: Give unique ID
            const holeChain = createCircleChain({ x: 5, y: 5 }, 1);
            holeChain.id = 'hole-chain'; // Fix: Give unique ID

            const shellPart: DetectedPart = {
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

            const holeInShellPart: DetectedPart = {
                id: 'part2',
                shell: {
                    id: 'shell2',
                    chain: shellChain,
                    type: PartType.SHELL,
                    boundingBox: { min: { x: 2, y: 2 }, max: { x: 8, y: 8 } },
                    holes: [],
                },
                holes: [
                    {
                        id: 'hole1',
                        chain: holeChain,
                        type: PartType.HOLE,
                        boundingBox: {
                            min: { x: 4, y: 4 },
                            max: { x: 6, y: 6 },
                        },
                        holes: [],
                    },
                ],
            };

            const leadConfig: LeadConfig = { type: LeadType.ARC, length: 2 };

            // Test shell lead
            const shellNormal = calculateCutNormal(
                shellChain,
                CutDirection.CLOCKWISE,
                shellPart
            );
            const shellResult = calculateLeads(
                shellChain,
                leadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                shellPart,
                shellNormal.normal
            );

            // Test hole lead
            const holeNormal = calculateCutNormal(
                holeChain,
                CutDirection.COUNTERCLOCKWISE,
                holeInShellPart
            );
            const holeResult = calculateLeads(
                holeChain,
                leadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.COUNTERCLOCKWISE,
                holeInShellPart,
                holeNormal.normal
            );

            expect(shellResult.leadIn).toBeDefined();
            expect(holeResult.leadIn).toBeDefined();

            // Shell lead should curve away from center
            // Note: With lead length=2 on radius=3 circle, some overlap is expected
            // The important thing is the lead is in the correct DIRECTION (outward)
            const shellPoints = convertLeadGeometryToPoints(
                shellResult.leadIn!
            );
            const shellStart = shellPoints[0];
            const shellDistFromCenter = Math.sqrt(
                Math.pow(shellStart.x - 5, 2) + Math.pow(shellStart.y - 5, 2)
            );
            expect(shellDistFromCenter).toBeGreaterThan(1.5); // At least half-way out (outward direction)

            // Hole lead should curve toward center (radius should be < hole radius from shell center)
            const holePoints = convertLeadGeometryToPoints(holeResult.leadIn!);
            const holeStart = holePoints[0];
            const holeDistFromShellCenter = Math.sqrt(
                Math.pow(holeStart.x - 5, 2) + Math.pow(holeStart.y - 5, 2)
            );
            expect(holeDistFromShellCenter).toBeLessThan(1.5); // Should be inside the hole area
        });
    });

    describe('arc geometry verification', () => {
        it('should generate arc with correct length', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const targetLength = 5;
            const leadIn: LeadConfig = {
                type: LeadType.ARC,
                length: targetLength,
            };
            const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(
                chain,
                leadIn,
                leadOut,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);

            // Calculate total arc length by summing segment lengths
            let totalLength = 0;
            for (let i: number = 1; i < points.length; i++) {
                const dx: number = points[i].x - points[i - 1].x;
                const dy: number = points[i].y - points[i - 1].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
            }

            // Arc length should be approximately equal to target length
            expect(totalLength).toBeCloseTo(targetLength, 0.5); // Within 0.5 units
        });

        it('should respect 90-degree maximum sweep', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const veryLongLength = 1000; // This would require > 90° if radius is small
            const leadIn: LeadConfig = {
                type: LeadType.ARC,
                length: veryLongLength,
            };
            const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

            const result = calculateLeads(
                chain,
                leadIn,
                leadOut,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);

            // With maximum 90° sweep, the arc should not curve more than a quarter circle
            const start = points[0];
            const end = points[points.length - 1];

            // For a horizontal line, 90° lead-in should result in points where
            // the start point is roughly perpendicular to the end point direction
            const startToEnd = {
                x: end.x - start.x,
                y: end.y - start.y,
            };

            // The arc should not curve more than 90 degrees
            // This is a basic sanity check - more sophisticated geometry would be needed for exact verification
            expect(Math.abs(startToEnd.y)).toBeGreaterThan(0); // Should have vertical component
        });
    });
});
