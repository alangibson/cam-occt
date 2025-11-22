import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import { Chain } from '$lib/geometry/chain/classes';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { convertLeadGeometryToPoints } from './functions';

describe('Lead Tangency Debug', () => {
    function createLineChain(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): ChainData {
        const shape: ShapeData = {
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

    it('should debug horizontal line lead-in geometry', () => {
        // Horizontal line from (0,0) to (10,0)
        const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
        const leadIn: LeadConfig = { type: LeadType.ARC, length: 5 };
        const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

        const result = calculateLeads(
            new Chain(chain),
            leadIn,
            leadOut,
            CutDirection.CLOCKWISE,
            undefined,
            { x: 1, y: 0 }
        );

        if (result.leadIn) {
            const points = convertLeadGeometryToPoints(result.leadIn);
            points.forEach(() => {
                // Process points
            });

            const connectionPoint = points[points.length - 1];
            const previousPoint = points[points.length - 2];

            const leadTangentFromPoints = {
                x: connectionPoint.x - previousPoint.x,
                y: connectionPoint.y - previousPoint.y,
            };

            // Let's also calculate the theoretical arc center and tangent
            if (points.length >= 3) {
                // Use 3-point method to find arc center
                const p1 = points[0];
                const p3 = connectionPoint;

                // For an arc, the tangent at any point is perpendicular to the radius at that point
                // If we can find the arc center, we can calculate the theoretical tangent

                // Estimate arc center by finding point equidistant from p1 and p3
                const chordDir = { x: p3.x - p1.x, y: p3.y - p1.y };
                const chordLen = Math.sqrt(
                    chordDir.x * chordDir.x + chordDir.y * chordDir.y
                );
                const chordNormal = {
                    x: -chordDir.y / chordLen,
                    y: chordDir.x / chordLen,
                };

                // Use chord normal for arc center calculation
                if (chordNormal.x !== undefined) {
                    // Process chord normal
                }
            }

            // Calculate angle using discrete tangent
            const lineTangent = { x: 1, y: 0 };
            const dot =
                leadTangentFromPoints.x * lineTangent.x +
                leadTangentFromPoints.y * lineTangent.y;
            const magLead = Math.sqrt(
                leadTangentFromPoints.x * leadTangentFromPoints.x +
                    leadTangentFromPoints.y * leadTangentFromPoints.y
            );
            const magLine = Math.sqrt(
                lineTangent.x * lineTangent.x + lineTangent.y * lineTangent.y
            );
            Math.acos(dot / (magLead * magLine));
        }

        // This is just a debug test
        expect(result.leadIn).toBeDefined();
    });
});
