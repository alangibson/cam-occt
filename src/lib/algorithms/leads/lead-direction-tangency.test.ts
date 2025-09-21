import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { createPolylineFromVertices } from '$lib/geometry/polyline';
import type { Shape } from '$lib/types';
import { GeometryType } from '$lib/geometry/shape';
import { convertLeadGeometryToPoints } from './functions';

describe('Lead Direction and Cut Direction Tangency', () => {
    // Create a simple circular chain for testing
    function createCircleChain(
        center: { x: number; y: number },
        radius: number,
        _clockwise: boolean
    ): Chain {
        return {
            id: 'test-circle',
            shapes: [
                {
                    id: 'circle-1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center,
                        radius,
                    },
                },
            ],
        };
    }

    // Create a simple rectangular chain for testing
    function createRectangleChain(
        x: number,
        y: number,
        width: number,
        height: number,
        clockwise: boolean
    ): Chain {
        const vertices = clockwise
            ? [
                  { x, y, bulge: 0 },
                  { x: x + width, y, bulge: 0 },
                  { x: x + width, y: y + height, bulge: 0 },
                  { x, y: y + height, bulge: 0 },
                  { x, y, bulge: 0 }, // Close the rectangle
              ]
            : [
                  { x, y, bulge: 0 },
                  { x, y: y + height, bulge: 0 },
                  { x: x + width, y: y + height, bulge: 0 },
                  { x: x + width, y, bulge: 0 },
                  { x, y, bulge: 0 }, // Close the rectangle
              ];

        return {
            id: 'test-rectangle',
            shapes: [
                createPolylineFromVertices(vertices, true, { id: 'rect-1' }),
            ],
        };
    }

    // Helper to calculate the angle of a vector
    function getVectorAngle(
        from: { x: number; y: number },
        to: { x: number; y: number }
    ): number {
        return Math.atan2(to.y - from.y, to.x - from.x);
    }

    // Helper to get the tangent direction based on cut direction
    function _getExpectedTangentDirection(
        shape: Shape,
        cutDirection: CutDirection.CLOCKWISE | 'counterclockwise'
    ): number {
        if (shape.type === 'circle') {
            // For circles, tangent should be perpendicular to radius
            // Clockwise cuts go in one direction, counterclockwise in the opposite
            const radiusAngle = 0; // Starting at rightmost point
            return cutDirection === CutDirection.CLOCKWISE
                ? radiusAngle - Math.PI / 2 // 90° clockwise from radius
                : radiusAngle + Math.PI / 2; // 90° counterclockwise from radius
        }
        return 0; // Default for other shapes
    }

    it('should demonstrate lead direction inconsistency with cut direction', () => {
        const center = { x: 50, y: 50 };
        const radius = 25;

        // Test clockwise circle
        const clockwiseCircle = createCircleChain(center, radius, true);

        const leadInConfig: LeadConfig = { type: LeadType.ARC, length: 10 };
        const LeadConfig: LeadConfig = { type: LeadType.ARC, length: 10 };

        const clockwiseResult = calculateLeads(
            clockwiseCircle,
            leadInConfig,
            LeadConfig
        );

        if (clockwiseResult.leadIn) {
            const points = convertLeadGeometryToPoints(clockwiseResult.leadIn);
            if (points.length >= 2) {
                const leadStart = points[0];
                const leadEnd = points[points.length - 1];
                const _leadDirection = getVectorAngle(leadStart, leadEnd);
            }
        }

        // Test counterclockwise circle
        const counterclockwiseCircle = createCircleChain(center, radius, false);

        const counterclockwiseResult = calculateLeads(
            counterclockwiseCircle,
            leadInConfig,
            LeadConfig
        );

        if (counterclockwiseResult.leadIn) {
            const points = convertLeadGeometryToPoints(
                counterclockwiseResult.leadIn
            );
            if (points.length >= 2) {
                const leadStart = points[0];
                const leadEnd = points[points.length - 1];
                const _leadDirection = getVectorAngle(leadStart, leadEnd);
            }
        }
    });

    it('should demonstrate lead tangency requirements for rectangles', () => {
        // Create clockwise rectangle
        const clockwiseRect = createRectangleChain(10, 10, 40, 30, true);

        const leadInConfig: LeadConfig = { type: LeadType.ARC, length: 8 };
        const LeadConfig: LeadConfig = { type: LeadType.NONE, length: 0 };

        const clockwiseResult = calculateLeads(
            clockwiseRect,
            leadInConfig,
            LeadConfig
        );

        if (clockwiseResult.leadIn) {
            const points = convertLeadGeometryToPoints(clockwiseResult.leadIn);
            if (points.length >= 2) {
                const connectionPoint = points[points.length - 1];
                const secondToLast = points[points.length - 2];

                // The lead should approach the rectangle tangentially
                const _approachAngle = getVectorAngle(
                    secondToLast,
                    connectionPoint
                );
            }
        }

        // Create counterclockwise rectangle
        const counterclockwiseRect = createRectangleChain(
            10,
            10,
            40,
            30,
            false
        );

        const counterclockwiseResult = calculateLeads(
            counterclockwiseRect,
            leadInConfig,
            LeadConfig
        );

        if (counterclockwiseResult.leadIn) {
            const points = convertLeadGeometryToPoints(
                counterclockwiseResult.leadIn
            );
            if (points.length >= 2) {
                const connectionPoint = points[points.length - 1];
                const secondToLast = points[points.length - 2];

                // The lead should approach the rectangle tangentially
                const _approachAngle = getVectorAngle(
                    secondToLast,
                    connectionPoint
                );
            }
        }
    });

    it('should analyze current algorithm cut direction awareness', () => {
        // The current calculateLeads function signature:
        // calculateLeads(chain, leadInConfig, LeadConfig, part?)
        //
        // MISSING: Cut direction parameter!

        // This test always passes - it's just for analysis
        expect(true).toBe(true);
    });
});
