import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import type { PartData } from '$lib/cam/part/interfaces';
import { PartType } from '$lib/cam/part/enums';
import { GeometryType } from '$lib/geometry/enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { convertLeadGeometryToPoints } from './functions';
import { Chain } from '$lib/cam/chain/classes';

describe('Lead Geometry Debug', () => {
    // Helper to create a simple line chain
    function createLineChain(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): Chain {
        const shape: ShapeData = {
            id: 'shape1',
            type: GeometryType.LINE,
            geometry: { start, end },
            layer: 'layer1',
        };

        return new Chain({
            id: 'chain1',
            shapes: [shape],
        });
    }

    // Helper to check if a point is inside a rectangle
    function isPointInRectangle(
        point: Point2D,
        minX: number,
        minY: number,
        maxX: number,
        maxY: number
    ): boolean {
        return (
            point.x >= minX &&
            point.x <= maxX &&
            point.y >= minY &&
            point.y <= maxY
        );
    }

    it('should show lead geometry for simple case', () => {
        // Create a simple shell line from (0,0) to (10,0)
        const shellChain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });

        // No part context - should generate a basic lead
        const leadIn: LeadConfig = { type: LeadType.ARC, length: 5 };
        const result = calculateLeads(
            shellChain,
            leadIn,
            {
                type: LeadType.NONE,
                length: 0,
            },
            CutDirection.CLOCKWISE,
            undefined,
            { x: 1, y: 0 }
        );

        expect(result.leadIn).toBeDefined();
        const points = convertLeadGeometryToPoints(result.leadIn!);

        points.forEach((_point, _i) => {
            // Log each point for debugging
        });

        // Check: lead should start away from line and end at (0,0)
        const endPoint = points[points.length - 1];

        expect(endPoint.x).toBeCloseTo(0, 5);
        expect(endPoint.y).toBeCloseTo(0, 5);
    });

    it('should show part geometry and solid area detection', () => {
        // Test our understanding of the part geometry
        const shellChain = createLineChain({ x: 0, y: 0 }, { x: 100, y: 0 }); // Bottom edge of shell

        const part: PartData = {
            id: 'part1',
            shell: shellChain,
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
            voids: [
                {
                    id: 'hole1',
                    chain: createLineChain({ x: 70, y: 70 }, { x: 90, y: 70 }), // Some hole
                    type: PartType.HOLE,
                    boundingBox: {
                        min: { x: 70, y: 70 },
                        max: { x: 90, y: 90 },
                    },
                },
            ],
            slots: [],
            layerName: '0',
        };

        // Test specific points
        const testPoints: Point2D[] = [
            { x: 50, y: 50 }, // Inside shell, outside hole = SOLID
            { x: 80, y: 80 }, // Inside shell, inside hole = NOT SOLID
            { x: -10, y: 50 }, // Outside shell = NOT SOLID
            { x: 110, y: 50 }, // Outside shell = NOT SOLID
        ];

        testPoints.forEach((point, _i) => {
            const inShell = isPointInRectangle(point, 0, 0, 100, 100);
            const inHole = isPointInRectangle(point, 70, 70, 90, 90);
            const _inSolid = inShell && !inHole;
        });

        // Generate a lead for this shell
        const leadIn: LeadConfig = { type: LeadType.ARC, length: 20 };
        const result = calculateLeads(
            shellChain,
            leadIn,
            { type: LeadType.NONE, length: 0 },
            CutDirection.NONE,
            part,
            { x: 1, y: 0 }
        );

        expect(result.leadIn).toBeDefined();
        const points = convertLeadGeometryToPoints(result.leadIn!);

        points.forEach((point, i) => {
            const inShell = isPointInRectangle(point, 0, 0, 100, 100);
            const inHole = isPointInRectangle(point, 70, 70, 90, 90);
            const _inSolid = inShell && !inHole;

            if (i < 5 || i >= points.length - 2) {
                // Show first few and last few points
                // Log detailed point information
            }
        });
    });
});
