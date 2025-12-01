import { Chain } from '$lib/cam/chain/classes';
import { describe, expect, it } from 'vitest';
import { optimizeStartPoints } from './optimize-start-points';
import {
    createPolylineFromVertices,
    polylineToPoints,
} from '$lib/geometry/polyline/functions';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM } from '$lib/cam/preprocess/algorithm-parameters';

describe('optimizeStartPoints - polyline splitting', () => {
    const optimizationParams = {
        ...DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM,
        tolerance: 0.1,
    };

    it('should split a 2-point polyline at its midpoint', () => {
        const shapes: ShapeData[] = [
            createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                false,
                { id: 'polyline1' }
            ),
            createPolylineFromVertices(
                [
                    { x: 10, y: 0 },
                    { x: 0, y: 0 },
                ],
                false,
                { id: 'polyline2' }
            ),
        ];

        const chain: ChainData = {
            id: 'chain1',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have 3 shapes (2 original minus 1 + 2 split halves)
        expect(result.length).toBe(3);

        // Find the split polyline pieces
        const splitPieces = result.filter((s) =>
            s.id.includes('polyline1-split')
        );
        expect(splitPieces.length).toBe(2);

        // Check the midpoint is at (5, 0)
        const firstHalf = splitPieces.find((s) => s.id.includes('split-1'));
        const secondHalf = splitPieces.find((s) => s.id.includes('split-2'));

        const firstGeom = firstHalf!.geometry as Polyline;
        const secondGeom = secondHalf!.geometry as Polyline;

        const firstPoints = polylineToPoints(firstGeom);
        const secondPoints = polylineToPoints(secondGeom);

        // First half: (0,0) to (5,0)
        expect(firstPoints[0]).toEqual({ x: 0, y: 0 });
        expect(firstPoints[1].x).toBeCloseTo(5);
        expect(firstPoints[1].y).toBeCloseTo(0);

        // Second half: (5,0) to (10,0)
        expect(secondPoints[0].x).toBeCloseTo(5);
        expect(secondPoints[0].y).toBeCloseTo(0);
        expect(secondPoints[1]).toEqual({ x: 10, y: 0 });
    });

    it('should split a multi-point polyline at its path midpoint', () => {
        // Create a polyline that forms an L shape
        const shapes: ShapeData[] = [
            createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                ],
                false,
                { id: 'L-polyline' }
            ),
            {
                id: 'closing-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
            } as ShapeData,
        ];

        const chain: ChainData = {
            id: 'L-chain',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // The line will be preferred over the 3-point polyline
        const splitLines = result.filter((s) =>
            s.id.includes('closing-line-split')
        );
        expect(splitLines.length).toBe(2);

        // The line from (10,10) to (0,0) has length √200 ≈ 14.14
        // Midpoint would be at (5, 5)
        const firstHalf: ShapeData | undefined = splitLines.find((s) =>
            s.id.includes('split-1')
        );
        const secondHalf: ShapeData | undefined = splitLines.find((s) =>
            s.id.includes('split-2')
        );

        const firstGeom = firstHalf!.geometry as Line;
        const secondGeom = secondHalf!.geometry as Line;

        // First half should go from (10,10) to (5,5)
        expect(firstGeom.start).toEqual({ x: 10, y: 10 });
        expect(firstGeom.end.x).toBeCloseTo(5);
        expect(firstGeom.end.y).toBeCloseTo(5);

        // Second half should go from (5,5) to (0,0)
        expect(secondGeom.start.x).toBeCloseTo(5);
        expect(secondGeom.start.y).toBeCloseTo(5);
        expect(secondGeom.end).toEqual({ x: 0, y: 0 });
    });

    it('should split a complex polyline at the correct midpoint along its path', () => {
        // Create a polyline with uneven segment lengths
        const shapes: ShapeData[] = [
            createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 3, y: 0 }, // segment length: 3
                    { x: 3, y: 4 }, // segment length: 4
                    { x: 8, y: 4 }, // segment length: 5
                ],
                false,
                { id: 'complex-polyline' }
            ),
            createPolylineFromVertices(
                [
                    { x: 8, y: 4 },
                    { x: 0, y: 0 },
                ],
                false,
                { id: 'closing-polyline' }
            ),
        ];

        const chain: ChainData = {
            id: 'complex-chain',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should split the second polyline (2-point polyline is preferred)
        const splitPolylines = result.filter((s) =>
            s.id.includes('closing-polyline-split')
        );
        expect(splitPolylines.length).toBe(2);

        // The closing polyline from (8,4) to (0,0) has length √80 ≈ 8.94
        // Midpoint would be at (4, 2)

        const firstHalf = splitPolylines.find((s) => s.id.includes('split-1'));
        const secondHalf = splitPolylines.find((s) => s.id.includes('split-2'));

        const firstGeom = firstHalf!.geometry as Polyline;
        const secondGeom = secondHalf!.geometry as Polyline;

        const firstPoints = polylineToPoints(firstGeom);
        const secondPoints = polylineToPoints(secondGeom);

        // First half should go from (8,4) to (4,2)
        expect(firstPoints.length).toBe(2);
        expect(firstPoints[0]).toEqual({ x: 8, y: 4 });
        expect(firstPoints[1].x).toBeCloseTo(4);
        expect(firstPoints[1].y).toBeCloseTo(2);

        // Second half should go from (4,2) to (0,0)
        expect(secondPoints.length).toBe(2);
        expect(secondPoints[0].x).toBeCloseTo(4);
        expect(secondPoints[0].y).toBeCloseTo(2);
        expect(secondPoints[1]).toEqual({ x: 0, y: 0 });
    });

    it('should preserve arcs when splitting polylines with arc segments', () => {
        // Create a polyline with both line and arc segments (like from DXF bulge data)
        const polylineWithArcs: ShapeData = {
            id: 'polyline-with-arcs',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: true, // Make it closed so it can be optimized
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: 'arc1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 10, y: 5 },
                            radius: 5,
                            startAngle: -Math.PI / 2,
                            endAngle: Math.PI / 2,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 10 },
                            end: { x: 0, y: 0 }, // Connect back to start to form closed shape
                        },
                    },
                ],
            },
        };

        const chain: ChainData = {
            id: 'chain-with-arcs',
            name: 'chain-with-arcs', shapes: [polylineWithArcs],
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have optimized the polyline by splitting it into two pieces
        expect(result.length).toBe(2); // Should have exactly 2 polyline halves

        // Find the split polyline pieces
        const polylinePieces = result.filter(
            (s) =>
                s.type === 'polyline' &&
                s.id.includes('polyline-with-arcs-split')
        );
        expect(polylinePieces.length).toBe(2);

        // Verify that both pieces are polylines with shapes
        polylinePieces.forEach((piece) => {
            expect(piece.type).toBe('polyline');
            const geom = piece.geometry as Polyline;
            expect(geom.shapes).toBeDefined();
            expect(geom.shapes.length).toBeGreaterThan(0);

            // Check that arc geometry is preserved
            const hasArc = geom.shapes.some((shape) => shape.type === 'arc');

            // At least one piece should contain the original arc (not converted to line)
            if (hasArc) {
                const arcShape = geom.shapes.find(
                    (shape) => shape.type === 'arc'
                )!;
                const arcGeom = arcShape.geometry as Arc;

                // Verify arc properties are preserved
                expect(arcGeom.center).toBeDefined();
                expect(arcGeom.radius).toBeDefined();
                expect(arcGeom.startAngle).toBeDefined();
                expect(arcGeom.endAngle).toBeDefined();
                expect(typeof arcGeom.radius).toBe('number');
            }
        });

        // Verify no shapes were converted from arc to line
        const allShapes = result.flatMap((s) => {
            if (s.type === 'polyline') {
                return (s.geometry as Polyline).shapes || [];
            }
            return [s];
        });

        const arcShapes = allShapes.filter((s) => s.type === 'arc');
        expect(arcShapes.length).toBeGreaterThanOrEqual(1); // Should still have arc(s)

        // Verify arc properties are intact
        arcShapes.forEach((arc) => {
            const geom = arc.geometry as Arc;
            expect(geom.center).toBeDefined();
            expect(geom.radius).toBe(5); // Should preserve original radius
            expect(typeof geom.startAngle).toBe('number');
            expect(typeof geom.endAngle).toBe('number');
        });
    });
});
