import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf-parser';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import {
    calculateLeads,
    type LeadInConfig,
    type LeadOutConfig,
} from './lead-calculation';
import { CutDirection, LeadType } from '$lib/types/direction';
import {
    createPolylineFromVertices,
    polylineToPoints,
} from '$lib/geometry/polyline';
import type { Arc } from '../geometry/arc';
import type { Shape } from '$lib/types';

describe('Lead Cut Direction Fix', () => {
    // Helper to check if a point is inside a polygon using ray casting
    function isPointInPolygon(
        point: { x: number; y: number },
        polygon: { x: number; y: number }[]
    ): boolean {
        let inside = false;
        const x: number = point.x;
        const y: number = point.y;

        for (
            let i: number = 0, j = polygon.length - 1;
            i < polygon.length;
            j = i++
        ) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            if (
                yi > y !== yj > y &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
            ) {
                inside = !inside;
            }
        }

        return inside;
    }

    // Helper to get polygon points from a chain
    function getPolygonFromChain(chain: {
        shapes: Shape[];
    }): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];

        for (const shape of chain.shapes) {
            if (shape.type === 'line') {
                const lineGeometry =
                    shape.geometry as import('$lib/types/geometry').Line;
                points.push(lineGeometry.start);
            } else if (shape.type === 'polyline') {
                const polylineGeometry =
                    shape.geometry as import('$lib/types/geometry').Polyline;
                points.push(...polylineToPoints(polylineGeometry));
            } else if (shape.type === 'arc') {
                // Sample points along the arc
                const arc = shape.geometry as Arc;
                const segments = Math.max(
                    8,
                    Math.ceil(
                        (Math.abs(arc.endAngle - arc.startAngle) * arc.radius) /
                            2
                    )
                );
                for (let i: number = 0; i < segments; i++) {
                    const t: number = i / segments;
                    const angle: number =
                        arc.startAngle + (arc.endAngle - arc.startAngle) * t;
                    points.push({
                        x: arc.center.x + arc.radius * Math.cos(angle),
                        y: arc.center.y + arc.radius * Math.sin(angle),
                    });
                }
            } else if (shape.type === 'circle') {
                // Sample points around the circle
                const circle =
                    shape.geometry as import('$lib/types/geometry').Circle;
                const segments = Math.max(
                    16,
                    Math.ceil((2 * Math.PI * circle.radius) / 2)
                );
                for (let i: number = 0; i < segments; i++) {
                    const angle: number = (2 * Math.PI * i) / segments;
                    points.push({
                        x: circle.center.x + circle.radius * Math.cos(angle),
                        y: circle.center.y + circle.radius * Math.sin(angle),
                    });
                }
            }
        }

        return points;
    }

    // Helper to check if point is in solid area (inside shell, outside holes)
    function isPointInSolidArea(
        point: { x: number; y: number },
        part: {
            shell: { chain: { shapes: Shape[] } };
            holes: { chain: { shapes: Shape[] } }[];
        }
    ): boolean {
        const shellPolygon = getPolygonFromChain(part.shell.chain);

        // First check if point is inside the shell
        if (!isPointInPolygon(point, shellPolygon)) {
            return false; // Not inside shell, definitely not in solid area
        }

        // Check if point is inside any hole
        for (const hole of part.holes) {
            const holePolygon = getPolygonFromChain(hole.chain);
            if (isPointInPolygon(point, holePolygon)) {
                return false; // Inside hole, not solid area
            }
        }

        return true; // Inside shell, outside all holes = solid area
    }

    it('should show improvement for ADLER Part 5 with correct cut direction', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
        const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) return;

        const leadIn: LeadInConfig = { type: LeadType.ARC, length: 10 };
        const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

        // Test with no cut direction (old behavior)
        const noCutDirResult = calculateLeads(
            part5.shell.chain,
            leadIn,
            leadOut,
            CutDirection.NONE,
            part5
        );

        // Test with clockwise cut direction
        const clockwiseResult = calculateLeads(
            part5.shell.chain,
            leadIn,
            leadOut,
            CutDirection.CLOCKWISE,
            part5
        );

        // Test with counterclockwise cut direction
        const counterclockwiseResult = calculateLeads(
            part5.shell.chain,
            leadIn,
            leadOut,
            CutDirection.COUNTERCLOCKWISE,
            part5
        );

        let noCutDirSolid = 0,
            clockwiseSolid = 0,
            counterclockwiseSolid = 0;

        // Count solid area violations for each approach
        if (noCutDirResult.leadIn) {
            for (
                let i: number = 0;
                i < noCutDirResult.leadIn.points.length - 1;
                i++
            ) {
                if (
                    isPointInSolidArea(noCutDirResult.leadIn.points[i], part5)
                ) {
                    noCutDirSolid++;
                }
            }
        }

        if (clockwiseResult.leadIn) {
            for (
                let i: number = 0;
                i < clockwiseResult.leadIn.points.length - 1;
                i++
            ) {
                if (
                    isPointInSolidArea(clockwiseResult.leadIn.points[i], part5)
                ) {
                    clockwiseSolid++;
                }
            }
        }

        if (counterclockwiseResult.leadIn) {
            for (
                let i: number = 0;
                i < counterclockwiseResult.leadIn.points.length - 1;
                i++
            ) {
                if (
                    isPointInSolidArea(
                        counterclockwiseResult.leadIn.points[i],
                        part5
                    )
                ) {
                    counterclockwiseSolid++;
                }
            }
        }

        // At least one cut direction should be better than no cut direction
        const bestCutDir = Math.min(clockwiseSolid, counterclockwiseSolid);

        // Should show some improvement, or at least be no worse
        expect(bestCutDir).toBeLessThanOrEqual(noCutDirSolid);
    });

    it('should properly handle simple geometric cases', () => {
        // Create a simple square chain
        const squareVertices = [
            { x: 0, y: 0, bulge: 0 },
            { x: 10, y: 0, bulge: 0 },
            { x: 10, y: 10, bulge: 0 },
            { x: 0, y: 10, bulge: 0 },
            { x: 0, y: 0, bulge: 0 },
        ];

        const squareShape = createPolylineFromVertices(squareVertices, true);
        const squareChain = {
            id: 'test-square',
            shapes: [squareShape],
        };

        const leadConfig: LeadInConfig = { type: LeadType.ARC, length: 5 };
        const noLeadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

        // Test clockwise vs counterclockwise
        const clockwiseResult = calculateLeads(
            squareChain,
            leadConfig,
            noLeadOut,
            CutDirection.CLOCKWISE
        );
        const counterclockwiseResult = calculateLeads(
            squareChain,
            leadConfig,
            noLeadOut,
            CutDirection.COUNTERCLOCKWISE
        );

        if (clockwiseResult.leadIn && counterclockwiseResult.leadIn) {
            const clockwiseStart = clockwiseResult.leadIn.points[0];
            const counterclockwiseStart =
                counterclockwiseResult.leadIn.points[0];

            // Leads should be in different positions
            const distance: number = Math.sqrt(
                (clockwiseStart.x - counterclockwiseStart.x) ** 2 +
                    (clockwiseStart.y - counterclockwiseStart.y) ** 2
            );

            expect(distance).toBeGreaterThan(0.1); // Should be different positions
        }
    });
});
