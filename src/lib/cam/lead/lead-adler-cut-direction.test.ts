import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { type ChainData } from '$lib/cam/chain/interfaces';
import { detectParts } from '$lib/cam/part/part-detection.functions';
import { type PartData } from '$lib/cam/part/interfaces';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { convertLeadGeometryToPoints } from './functions';
import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { isPointInPolygon } from '$lib/geometry/polygon/functions';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';
import { getShapePoints } from '$lib/cam/shape/functions';

describe('ADLER Part 5 Cut Direction Analysis', () => {
    // Helper to get polygon points from a chain
    function getPolygonFromChain(chain: ChainData): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];

        for (const shape of chain.shapes) {
            const shapePoints = getShapePoints(new Shape(shape), {
                mode: 'TESSELLATION',
            });
            points.push(...shapePoints);
        }

        return points;
    }

    // Helper to check if point is in solid area (inside shell, outside holes)
    function isPointInSolidArea(
        point: { x: number; y: number },
        part: PartData
    ): boolean {
        const shellPolygon = getPolygonFromChain(part.shell);

        // First check if point is inside the shell
        if (!isPointInPolygon(point, { points: shellPolygon })) {
            return false; // Not inside shell, definitely not in solid area
        }

        // Check if point is inside any hole
        for (const hole of part.voids) {
            const holePolygon = getPolygonFromChain(hole.chain);
            if (isPointInPolygon(point, { points: holePolygon })) {
                return false; // Inside hole, not solid area
            }
        }

        return true; // Inside shell, outside all holes = solid area
    }

    it('should find best cut direction for ADLER Part 5', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent);
        // Decompose polylines before chain detection
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );
        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });
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
                    new Chain(part5.shell),
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
                        if (isPointInSolidArea(points[i], part5)) {
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
            new Chain(part5.shell),
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
                if (isPointInSolidArea(shortPoints[i], part5)) {
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
        // Decompose polylines before chain detection
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );
        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) return;

        // Analyze the shell geometry
        const shellShape = part5.shell.shapes[0];
        const points = getShapePoints(new Shape(shellShape), {
            mode: 'TESSELLATION',
        });
        if (points.length > 0) {
            // Find the nearest edge of the bounding box to understand constraints
            const bbox = part5.boundingBox;
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
        if (part5.voids.length > 0) {
            const holeShape = part5.voids[0].chain.shapes[0];
            const holePoints = getShapePoints(new Shape(holeShape), {
                mode: 'TESSELLATION',
            });
            if (holePoints.length > 0) {
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

                const connectionPoint = points[0];
                const _distToHole = Math.sqrt(
                    (connectionPoint.x - holeCenter.x) ** 2 +
                        (connectionPoint.y - holeCenter.y) ** 2
                );
            }
        }
    });
});
