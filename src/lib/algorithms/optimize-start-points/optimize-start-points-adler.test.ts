import { Chain } from '$lib/cam/chain/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';
import { describe, expect, it } from 'vitest';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { createPolylineFromVertices } from '$lib/geometry/dxf-polyline/functions';
import { DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM } from '$lib/cam/preprocess/algorithm-parameters';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { optimizeStartPoints } from './optimize-start-points';

describe('optimizeStartPoints - ADLER.dxf scenario', () => {
    const optimizationParams = {
        ...DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM,
        tolerance: 0.1,
    };

    it('should not optimize polyline-only chains (polylines are not splittable)', () => {
        // Simulate typical ADLER.dxf chains - closed polylines with multiple segments
        // These chains should NOT be optimized because polylines are no longer splittable
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
                name: `Chain ${i}`,
                shapes,
            });
        }

        // Add a chain with a line segment (which should be preferred for splitting)
        const mixedChain: ChainData = {
            id: 'chain-mixed',
            name: 'chain-mixed',
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

        // Run optimization - wrap ChainData objects with Chain class
        const result = optimizeStartPoints(
            chains.map((c) => new Chain(c)),
            optimizationParams
        );

        // NEW EXPECTATION: Only the mixed chain should be optimized (it has a line)
        // The 5 polyline-only chains are not splittable

        // Count how many shapes have "-split-" in their ID
        const splitShapeCount = result.filter((s) =>
            s.id.includes('-split-')
        ).length;

        // Only the mixed chain should have one line split into two parts
        expect(splitShapeCount).toBe(2); // 1 chain × 2 split parts

        // Total shape count should increase by 1 (1 line split into two)
        expect(result.length).toBe(originalShapeCount + 1);

        // Verify the line was split
        const splitLines = result.filter((s) => s.id.includes('line-1-split'));
        expect(splitLines.length).toBe(2);
    });

    it('should not optimize chains where all shapes are complex (no simple shapes to split)', () => {
        // Create a chain with only polylines and splines - no splittable shapes
        const complexChain: ChainData = {
            id: 'complex-chain',
            name: 'complex-chain',
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

        const result = optimizeStartPoints(
            [new Chain(complexChain)],
            optimizationParams
        );

        // Should NOT modify the chain - no splittable shapes (no lines or arcs)
        expect(result.length).toBe(3); // 3 original shapes unchanged
        expect(result.filter((s) => s.id.includes('-split-')).length).toBe(0); // No splits
    });

    it('should not optimize ADLER.dxf-style polyline-only chains', () => {
        // Most realistic ADLER.dxf scenario: closed chains made of polylines with bulges
        // These cannot be optimized because polylines are not splittable
        const adlerStyleChain: ChainData = {
            id: 'adler-chain',
            name: 'adler-chain',
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
            [new Chain(adlerStyleChain)],
            optimizationParams
        );

        // Polyline-only chains are not optimized
        expect(result.length).toBe(2); // 2 original shapes unchanged
        expect(result.filter((s) => s.id.includes('-split-')).length).toBe(0); // No splits

        // Note: To optimize ADLER.dxf polylines, they should be decomposed first
    });
});
