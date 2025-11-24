import { GeometryType } from '$lib/geometry/enums';
import { describe, expect, it } from 'vitest';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { createPolylineFromVertices } from '$lib/geometry/polyline/functions';
import { DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM } from '$lib/preprocessing/algorithm-parameters';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { optimizeStartPoints } from './optimize-start-points';

describe('optimizeStartPoints - ADLER.dxf scenario', () => {
    const optimizationParams = {
        ...DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM,
        tolerance: 0.1,
    };

    it('should optimize multiple closed polyline chains like in ADLER.dxf', () => {
        // Simulate typical ADLER.dxf chains - closed polylines with multiple segments
        const chains: ChainData[] = [];

        // Create 5 closed chains similar to what's in ADLER.dxf
        for (let i: number = 0; i < 5; i++) {
            const xOffset = i * 20;
            const shapes: ShapeData[] = [
                {
                    id: `polyline-${i}-1`,
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: xOffset + 0, y: 0, bulge: 0 },
                            { x: xOffset + 10, y: 0, bulge: 0 },
                            { x: xOffset + 10, y: 5, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
                {
                    id: `polyline-${i}-2`,
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: xOffset + 10, y: 5, bulge: 0 },
                            { x: xOffset + 10, y: 10, bulge: 0 },
                            { x: xOffset + 0, y: 10, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
                {
                    id: `polyline-${i}-3`,
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: xOffset + 0, y: 10, bulge: 0 },
                            { x: xOffset + 0, y: 0, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
            ];

            chains.push({
                id: `chain-${i}`,
                shapes,
            });
        }

        // Add a chain with a line segment (which should be preferred for splitting)
        const mixedChain: ChainData = {
            id: 'chain-mixed',
            shapes: [
                {
                    id: 'line-1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 100, y: 0 },
                        end: { x: 110, y: 0 },
                    },
                },
                {
                    id: 'polyline-mixed-1',
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: 110, y: 0, bulge: 0 },
                            { x: 110, y: 10, bulge: 0 },
                            { x: 100, y: 10, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
                {
                    id: 'polyline-mixed-2',
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: 100, y: 10, bulge: 0 },
                            { x: 100, y: 0, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
            ],
        };
        chains.push(mixedChain);

        const originalShapeCount = chains.reduce(
            (sum, chain) => sum + chain.shapes.length,
            0
        );

        // Run optimization
        const result = optimizeStartPoints(chains, optimizationParams);

        // NEW EXPECTATION: All chains should be modified now that we support polylines
        // Each chain should have one shape split into two

        // Count how many shapes have "-split-" in their ID
        const splitShapeCount = result.filter((s) =>
            s.id.includes('-split-')
        ).length;

        // Each of the 6 chains should have one shape split into two parts
        expect(splitShapeCount).toBe(12); // 6 chains × 2 split parts each

        // Total shape count should increase by 6 (6 shapes split into two each)
        expect(result.length).toBe(originalShapeCount + 6);

        // Verify the line was split
        const splitLines = result.filter((s) => s.id.includes('line-1-split'));
        expect(splitLines.length).toBe(2);
    });

    it('should handle chains where all shapes are complex (no simple shapes to split)', () => {
        // Create a chain with only polylines and splines
        const complexChain: ChainData = {
            id: 'complex-chain',
            shapes: [
                {
                    id: 'polyline-1',
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: 0, y: 0, bulge: 0 },
                            { x: 10, y: 0, bulge: 0 },
                            { x: 10, y: 10, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
                {
                    id: 'spline-1',
                    type: GeometryType.SPLINE,
                    geometry: {
                        controlPoints: [
                            { x: 10, y: 10 },
                            { x: 5, y: 15 },
                            { x: 0, y: 10 },
                        ],
                        knots: [0, 0, 0, 1, 1, 1],
                        weights: [1, 1, 1],
                        degree: 2,
                        fitPoints: [],
                        closed: false,
                    },
                },
                {
                    id: 'polyline-2',
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: 0, y: 10, bulge: 0 },
                            { x: 0, y: 0, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
            ],
        };

        const result = optimizeStartPoints([complexChain], optimizationParams);

        // Now it SHOULD modify the chain since we support polylines
        expect(result.length).toBe(4); // 3 original + 1 from split
        expect(result.filter((s) => s.id.includes('-split-')).length).toBe(2); // One polyline split into 2 parts
    });

    it('should show why ADLER.dxf chains are not being optimized', () => {
        // Most realistic ADLER.dxf scenario: closed chains made of polylines with bulges
        // that have been converted to polylines
        const adlerStyleChain: ChainData = {
            id: 'adler-chain',
            shapes: [
                {
                    id: 'converted-polyline-1',
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: 0, y: 0, bulge: 0 },
                            { x: 5, y: 0, bulge: 0 },
                            { x: 10, y: 0, bulge: 0 },
                            { x: 15, y: 0, bulge: 0 },
                            { x: 20, y: 0, bulge: 0 },
                            { x: 20, y: 5, bulge: 0 },
                            { x: 20, y: 10, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
                {
                    id: 'converted-polyline-2',
                    type: GeometryType.POLYLINE,
                    geometry: createPolylineFromVertices(
                        [
                            { x: 20, y: 10, bulge: 0 },
                            { x: 15, y: 10, bulge: 0 },
                            { x: 10, y: 10, bulge: 0 },
                            { x: 5, y: 10, bulge: 0 },
                            { x: 0, y: 10, bulge: 0 },
                            { x: 0, y: 5, bulge: 0 },
                            { x: 0, y: 0, bulge: 0 },
                        ],
                        false
                    ).geometry,
                },
            ],
        };

        const result = optimizeStartPoints(
            [adlerStyleChain],
            optimizationParams
        );

        // NEW BEHAVIOR: Optimization now works because we support polylines!
        expect(result.length).toBe(3); // 2 original + 1 from split
        expect(result.filter((s) => s.id.includes('-split-')).length).toBe(2); // One polyline split into 2 parts

        // Success! ADLER.dxf polylines can now be optimized
    });
});
