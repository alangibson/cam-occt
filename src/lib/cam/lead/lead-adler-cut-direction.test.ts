import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { type Chain } from '$lib/geometry/chain/interfaces';
import { detectParts } from '$lib/cam/part/part-detection';
import { type PartShell } from '$lib/cam/part/interfaces';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { polylineToPoints } from '$lib/geometry/polyline/functions';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import { convertLeadGeometryToPoints } from './functions';

describe('ADLER Part 5 Cut Direction Analysis', () => {
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
    function getPolygonFromChain(chain: Chain): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];

        for (const shape of chain.shapes) {
            if (shape.type === 'line') {
                const lineGeometry = shape.geometry as Line;
                points.push(lineGeometry.start);
            } else if (shape.type === 'polyline') {
                const polylineGeometry = shape.geometry as Polyline;
                points.push(...polylineToPoints(polylineGeometry));
            }
        }

        return points;
    }

    // Helper to check if point is in solid area (inside shell, outside holes)
    function isPointInSolidArea(
        point: { x: number; y: number },
        part: PartShell
    ): boolean {
        const shellPolygon = getPolygonFromChain(part.chain);

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

    it('should find best cut direction for ADLER Part 5', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent);
        const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) return;

        // Test different lead lengths with both cut directions
        const testLengths = [2, 5, 8, 10, 15];
        const cutDirections = [
            CutDirection.CLOCKWISE,
            CutDirection.COUNTERCLOCKWISE,
        ];

        for (const length of testLengths) {
            const leadIn: LeadConfig = { type: LeadType.ARC, length };
            const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

            const results: Array<{
                direction: string;
                solidPoints: number;
                warnings: number;
            }> = [];

            for (const cutDirection of cutDirections) {
                const cutNormal: Point2D = { x: 1, y: 0 };
                const result = calculateLeads(
                    part5.shell.chain,
                    leadIn,
                    leadOut,
                    cutDirection,
                    part5,
                    cutNormal
                );

                let solidPoints = 0;
                if (result.leadIn) {
                    const points = convertLeadGeometryToPoints(result.leadIn);
                    for (let i: number = 0; i < points.length - 1; i++) {
                        if (isPointInSolidArea(points[i], part5.shell)) {
                            solidPoints++;
                        }
                    }
                }

                results.push({
                    direction: cutDirection,
                    solidPoints,
                    warnings: result.warnings?.length || 0,
                });
            }

            const clockwise = results[0];
            const counter = results[1];
            const _best =
                clockwise.solidPoints <= counter.solidPoints ? 'CW' : 'CCW';
        }

        // Test with very short leads
        const cutNormal: Point2D = { x: 1, y: 0 };
        const shortResult = calculateLeads(
            part5.shell.chain,
            { type: LeadType.ARC, length: 1 },
            { type: LeadType.NONE, length: 0 },
            CutDirection.COUNTERCLOCKWISE,
            part5,
            cutNormal
        );

        if (shortResult.leadIn) {
            let solidPoints = 0;
            const shortPoints = convertLeadGeometryToPoints(shortResult.leadIn);
            for (let i: number = 0; i < shortPoints.length - 1; i++) {
                if (isPointInSolidArea(shortPoints[i], part5.shell)) {
                    solidPoints++;
                }
            }

            if (solidPoints === 0) {
                // No solid points in short lead
            }
        }
    });

    it('should analyze Part 5 geometry for lead placement insights', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent);
        const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) return;

        // Analyze the shell geometry
        const shellShape = part5.shell.chain.shapes[0];
        if (shellShape.type === 'polyline') {
            const points = polylineToPoints(shellShape.geometry as Polyline);

            // Find the nearest edge of the bounding box to understand constraints
            const bbox = part5.shell.boundingBox;
            const connectionPoint = points[0];

            const distToLeft = connectionPoint.x - bbox.min.x;
            const distToRight = bbox.max.x - connectionPoint.x;
            const distToBottom = connectionPoint.y - bbox.min.y;
            const distToTop = bbox.max.y - connectionPoint.y;

            const minDist = Math.min(
                distToLeft,
                distToRight,
                distToBottom,
                distToTop
            );

            if (minDist < 15) {
                // Lead is near boundary
            }
        }

        // Analyze hole position relative to connection point
        if (part5.holes.length > 0) {
            const holeShape = part5.holes[0].chain.shapes[0];
            if (holeShape.type === 'polyline') {
                const holePoints = polylineToPoints(
                    holeShape.geometry as Polyline
                );
                const holeCenter = {
                    x:
                        holePoints.reduce(
                            (sum: number, p: { x: number; y: number }) =>
                                sum + p.x,
                            0
                        ) / holePoints.length,
                    y:
                        holePoints.reduce(
                            (sum: number, p: { x: number; y: number }) =>
                                sum + p.y,
                            0
                        ) / holePoints.length,
                };

                const connectionPoint = polylineToPoints(
                    shellShape.geometry as Polyline
                )[0];
                const _distToHole = Math.sqrt(
                    (connectionPoint.x - holeCenter.x) ** 2 +
                        (connectionPoint.y - holeCenter.y) ** 2
                );
            }
        }
    });
});
