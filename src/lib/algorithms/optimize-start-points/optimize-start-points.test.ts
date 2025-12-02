import { Chain } from '$lib/cam/chain/classes';
import { describe, expect, it } from 'vitest';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { createPolylineFromVertices } from '$lib/geometry/polyline/functions';
import { DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM } from '$lib/cam/preprocess/algorithm-parameters';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { optimizeStartPoints } from './optimize-start-points';

describe('optimizeStartPoints', () => {
    const optimizationParams = {
        ...DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM,
        tolerance: 0.1,
    };

    it('should split a line at its midpoint for a closed chain', () => {
        // Create a simple closed triangular chain with lines
        const shapes: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 5, y: 8.66 },
                },
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 5, y: 8.66 },
                    end: { x: 0, y: 0 },
                },
            },
        ];

        const chain: ChainData = {
            id: 'chain1',
            name: 'chain1',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have 4 shapes now (original 3 minus 1 split shape plus 2 split halves)
        expect(result.length).toBe(4);

        // First shape should be the second half of the split line
        const firstShape = result[0];
        expect(firstShape.type).toBe('line');
        expect(firstShape.id).toContain('split-2');

        // The midpoint of line1 should be at (5, 0)
        const firstGeom = firstShape.geometry as Line;
        expect(firstGeom.start.x).toBeCloseTo(5);
        expect(firstGeom.start.y).toBeCloseTo(0);
        expect(firstGeom.end.x).toBeCloseTo(10);
        expect(firstGeom.end.y).toBeCloseTo(0);
    });

    it('should split an arc when no lines are available', () => {
        // Create a closed chain with only an arc and polylines
        const shapes: ShapeData[] = [
            {
                id: 'arc1',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 10,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
            },
            createPolylineFromVertices(
                [
                    { x: 0, y: 10, bulge: 0 },
                    { x: 0, y: 5, bulge: 0 },
                    { x: 0, y: 0, bulge: 0 },
                ],
                false,
                { id: 'polyline1' }
            ),
            createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 5, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                ],
                false,
                { id: 'polyline2' }
            ),
        ];

        const chain: ChainData = {
            id: 'chain1',
            name: 'Chain 1',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have 4 shapes now (2 polylines + 2 arc halves)
        expect(result.length).toBe(4);

        // Should have split the arc since no lines are available
        const splitArcIds = result.filter((s) =>
            s.id.includes('arc1-split')
        ).length;
        expect(splitArcIds).toBe(2);

        // Check the split arc pieces
        const arcPieces = result.filter((s) => s.id.includes('arc1-split'));
        const firstArc = arcPieces.find((s) => s.id.includes('split-1'));
        const secondArc = arcPieces.find((s) => s.id.includes('split-2'));

        expect(firstArc).toBeDefined();
        expect(secondArc).toBeDefined();

        // The midpoint angle should be PI/4 (45 degrees)
        const firstGeom = firstArc!.geometry as Arc;
        const secondGeom = secondArc!.geometry as Arc;
        expect(firstGeom.startAngle).toBeCloseTo(0);
        expect(firstGeom.endAngle).toBeCloseTo(Math.PI / 4);
        expect(secondGeom.startAngle).toBeCloseTo(Math.PI / 4);
        expect(secondGeom.endAngle).toBeCloseTo(Math.PI / 2);
    });

    it('should prefer lines over complex shapes for splitting', () => {
        // Create a closed chain with a spline and a line
        const shapes: ShapeData[] = [
            {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                        { x: 10, y: 0 },
                    ],
                    knots: [0, 0, 0, 1, 1, 1],
                    weights: [1, 1, 1],
                    degree: 2,
                    fitPoints: [],
                    closed: false,
                },
            },
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 0, y: 0 },
                },
            },
        ];

        const chain: ChainData = {
            id: 'chain1',
            name: 'Chain 1',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have 3 shapes (spline + 2 line halves)
        expect(result.length).toBe(3);

        // Should have split the line, not the spline
        const splitLineIds = result.filter((s) =>
            s.id.includes('line1-split')
        ).length;
        expect(splitLineIds).toBe(2);

        // Spline should remain unsplit
        const splines = result.filter((s) => s.type === 'spline');
        expect(splines.length).toBe(1);
        expect(splines[0].id).toBe('spline1');
    });

    it('should not modify open chains', () => {
        // Create an open chain
        const shapes: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 20, y: 10 },
                },
            },
        ];

        const chain: ChainData = {
            id: 'chain1',
            name: 'Chain 1',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have same number of shapes
        expect(result.length).toBe(2);

        // Shapes should be unchanged
        expect(result[0].id).toBe('line1');
        expect(result[1].id).toBe('line2');
    });

    it('should not modify single-shape chains', () => {
        // Create a single-shape chain (circle)
        const shapes: ShapeData[] = [
            {
                id: 'circle1',
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 10,
                },
            },
        ];

        const chain: ChainData = {
            id: 'chain1',
            name: 'Chain 1',
            shapes,
        };

        const result = optimizeStartPoints(
            [new Chain(chain)],
            optimizationParams
        );

        // Should have same single shape
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('circle1');
    });

    it('should handle multiple chains correctly', () => {
        // Create two chains, one closed and one open
        const chain1: ChainData = {
            id: 'chain1',
            name: 'chain1',
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
                    id: 'line2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 10, y: 0 },
                        end: { x: 0, y: 0 },
                    },
                },
            ],
        };

        const chain2: ChainData = {
            id: 'chain2',
            name: 'chain2',
            shapes: [
                {
                    id: 'line3',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 20, y: 0 },
                        end: { x: 30, y: 0 },
                    },
                },
            ],
        };

        const result = optimizeStartPoints(
            [new Chain(chain1), new Chain(chain2)],
            optimizationParams
        );

        // Chain1 should be split (3 shapes), chain2 should be unchanged (1 shape)
        expect(result.length).toBe(4);

        // Check that line1 was split
        const splitLineIds = result.filter((s) =>
            s.id.includes('line1-split')
        ).length;
        expect(splitLineIds).toBe(2);
    });
});
