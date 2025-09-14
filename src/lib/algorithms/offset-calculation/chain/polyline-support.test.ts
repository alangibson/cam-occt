import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { offsetChain } from './offset';
import { scaleShape } from '$lib/geometry/shape/functions';
import { Unit, getPhysicalScaleFactor } from '$lib/utils/units';
import { calculateDynamicTolerance } from '$lib/geometry/bounding-box';
import {
    type Drawing,
    GeometryType,
    type Polyline,
    type Shape,
} from '$lib/types/geometry';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';
import { generateId } from '$lib/domain/id';

describe('offsetChain Polyline Support', () => {
    it('should offset a closed rectangular polyline correctly', () => {
        // Create a closed rectangular polyline (100x100 square)
        const rectangularPolyline: Polyline & { id: string } = {
            id: 'test-polyline-1',
            closed: true,
            shapes: [
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 100, y: 0 },
                        end: { x: 100, y: 100 },
                    },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 100, y: 100 },
                        end: { x: 0, y: 100 },
                    },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
                },
            ],
        };

        const offsetDistance = 10;
        const result = offsetChain(rectangularPolyline, offsetDistance, {
            tolerance: 0.05,
            maxExtension: 20,
            snapThreshold: 0.1,
        });

        // Should succeed
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);

        // For a closed polyline, should have inner and outer chains
        expect(result.innerChain).toBeDefined();
        expect(result.outerChain).toBeDefined();

        // Both chains should have 4 shapes (rectangle)
        expect(result.innerChain!.shapes).toHaveLength(4);
        expect(result.outerChain!.shapes).toHaveLength(4);

        // Inner and outer chains should be marked as closed
        expect(result.innerChain!.closed).toBe(true);
        expect(result.outerChain!.closed).toBe(true);

        // Should reference the original polyline ID
        expect(result.innerChain!.originalChainId).toBe('test-polyline-1');
        expect(result.outerChain!.originalChainId).toBe('test-polyline-1');
    });

    it('should offset an open polyline correctly', () => {
        // Create an open L-shaped polyline
        const openPolyline: Polyline & { id: string } = {
            id: 'test-polyline-2',
            closed: false,
            shapes: [
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 100, y: 0 },
                        end: { x: 100, y: 100 },
                    },
                },
            ],
        };

        const offsetDistance = 10;
        const result = offsetChain(openPolyline, offsetDistance, {
            tolerance: 0.05,
            maxExtension: 20,
            snapThreshold: 0.1,
        });

        // Should succeed
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);

        // For an open polyline, should have left and right chains (mapped to inner/outer)
        expect(result.innerChain || result.outerChain).toBeDefined();

        // Should reference the original polyline ID
        if (result.innerChain) {
            expect(result.innerChain.originalChainId).toBe('test-polyline-2');
            expect(result.innerChain.closed).toBe(false);
        }
        if (result.outerChain) {
            expect(result.outerChain.originalChainId).toBe('test-polyline-2');
            expect(result.outerChain.closed).toBe(false);
        }
    });

    it('should respect polyline closed flag over geometric analysis', () => {
        // Create a polyline that's geometrically closed but marked as open
        const geometricallyClosedPolyline: Polyline & { id: string } = {
            id: 'test-polyline-3',
            closed: false, // Explicitly marked as open
            shapes: [
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 100, y: 0 },
                        end: { x: 100, y: 100 },
                    },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 100, y: 100 },
                        end: { x: 0, y: 100 },
                    },
                },
                {
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
                },
            ],
        };

        const offsetDistance = 10;
        const result = offsetChain(
            geometricallyClosedPolyline,
            offsetDistance,
            {
                tolerance: 0.05,
                maxExtension: 20,
                snapThreshold: 0.1,
            }
        );

        // Should succeed
        expect(result.success).toBe(true);

        // Should treat as open chain (left/right) despite geometric closure
        // This means the offset chains should not be marked as closed
        expect(result.innerChain?.closed).toBe(false);
        expect(result.outerChain?.closed).toBe(false);
    });

    it('should work identically to chain input for equivalent geometry', () => {
        // Create identical geometry as both Chain and Polyline
        const shapes: Shape[] = [
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
            },
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
            },
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 100, y: 100 }, end: { x: 0, y: 100 } },
            },
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
            },
        ];

        const chain: Chain = {
            id: 'test-chain-1',
            shapes: shapes,
        };

        const polyline: Polyline & { id: string } = {
            id: 'test-polyline-4',
            closed: true,
            shapes: shapes,
        };

        const offsetDistance = 10;
        const params = {
            tolerance: 0.05,
            maxExtension: 20,
            snapThreshold: 0.1,
        };

        const chainResult = offsetChain(chain, offsetDistance, params);
        const polylineResult = offsetChain(polyline, offsetDistance, params);

        // Both should succeed
        expect(chainResult.success).toBe(true);
        expect(polylineResult.success).toBe(true);

        // Both should have the same structure
        expect(!!chainResult.innerChain).toBe(!!polylineResult.innerChain);
        expect(!!chainResult.outerChain).toBe(!!polylineResult.outerChain);

        if (chainResult.innerChain && polylineResult.innerChain) {
            expect(chainResult.innerChain.shapes.length).toBe(
                polylineResult.innerChain.shapes.length
            );
            expect(chainResult.innerChain.closed).toBe(
                polylineResult.innerChain.closed
            );
        }

        if (chainResult.outerChain && polylineResult.outerChain) {
            expect(chainResult.outerChain.shapes.length).toBe(
                polylineResult.outerChain.shapes.length
            );
            expect(chainResult.outerChain.closed).toBe(
                polylineResult.outerChain.closed
            );
        }
    });

    describe('Side Classification Fix', () => {
        it('should correctly classify inner and outer offsets for polylines_with_bulge.dxf', async () => {
            // Load and process the DXF file that had the original bug
            const dxfContent = readFileSync(
                'tests/dxf/polylines_with_bulge.dxf',
                'utf-8'
            );
            const drawing: Drawing = await parseDXF(dxfContent);

            // Scale shapes for proper processing
            const physicalScale = getPhysicalScaleFactor(
                drawing.units,
                Unit.MM
            );
            const shapes = drawing.shapes.map((shape) =>
                scaleShape(shape, physicalScale, { x: 0, y: 0 })
            );

            // Calculate tolerance and detect chains
            const tolerance = calculateDynamicTolerance(shapes, 0.1);
            const detectedChains = detectShapeChains(shapes, { tolerance });

            expect(detectedChains).toHaveLength(2);

            // Process each chain and verify offset classification
            const results = [];
            for (const chain of detectedChains) {
                const normalizedChain = normalizeChain(chain, {
                    traversalTolerance: tolerance,
                    maxTraversalAttempts: 5,
                });

                const offsetDistance = 1 * physicalScale;
                const offsetResult = offsetChain(
                    normalizedChain,
                    offsetDistance,
                    {
                        tolerance,
                        maxExtension: 5 * physicalScale,
                        snapThreshold: 0.5 * physicalScale,
                    }
                );

                results.push(offsetResult);
            }

            // Verify that each chain has both inner and outer offsets OR only one type
            // but never both classified as the same incorrect type
            for (let i: number = 0; i < results.length; i++) {
                const result = results[i];

                // We should have at least one offset chain
                const hasInner =
                    result.innerChain !== undefined &&
                    result.innerChain.shapes.length > 0;
                const hasOuter =
                    result.outerChain !== undefined &&
                    result.outerChain.shapes.length > 0;

                expect(
                    hasInner || hasOuter,
                    `Chain ${i + 1} should have at least one offset`
                ).toBe(true);

                // For closed chains with bulges, we expect both inner and outer offsets
                if (hasInner && hasOuter) {
                    expect(
                        result.innerChain!.shapes.length,
                        `Chain ${i + 1} inner offset should have shapes`
                    ).toBeGreaterThan(0);
                    expect(
                        result.outerChain!.shapes.length,
                        `Chain ${i + 1} outer offset should have shapes`
                    ).toBeGreaterThan(0);
                    expect(
                        result.innerChain!.side,
                        `Chain ${i + 1} inner chain should be classified as inner`
                    ).toBe('inner');
                    expect(
                        result.outerChain!.side,
                        `Chain ${i + 1} outer chain should be classified as outer`
                    ).toBe('outer');
                }
            }

            // Overall validation: we should have inner offsets for all chains that support them
            const totalInnerChains = results.filter(
                (r) => r.innerChain !== undefined
            ).length;
            const totalOuterChains = results.filter(
                (r) => r.outerChain !== undefined
            ).length;

            expect(
                totalInnerChains,
                'Should have inner offset chains'
            ).toBeGreaterThan(0);
            expect(
                totalOuterChains,
                'Should have outer offset chains'
            ).toBeGreaterThan(0);
        });

        it('should never classify both offsets of a closed shape as the same side', async () => {
            // This test specifically verifies the fix for the issue where both
            // positive and negative offsets were incorrectly classified as "outer"

            const dxfContent = readFileSync(
                'tests/dxf/polylines_with_bulge.dxf',
                'utf-8'
            );
            const drawing: Drawing = await parseDXF(dxfContent);

            const physicalScale = getPhysicalScaleFactor(
                drawing.units,
                Unit.MM
            );
            const shapes = drawing.shapes.map((shape) =>
                scaleShape(shape, physicalScale, { x: 0, y: 0 })
            );

            const tolerance = calculateDynamicTolerance(shapes, 0.1);
            const detectedChains = detectShapeChains(shapes, { tolerance });

            for (const chain of detectedChains) {
                const normalizedChain = normalizeChain(chain, {
                    traversalTolerance: tolerance,
                    maxTraversalAttempts: 5,
                });

                const offsetDistance = 1 * physicalScale;
                const offsetResult = offsetChain(
                    normalizedChain,
                    offsetDistance,
                    {
                        tolerance,
                        maxExtension: 5 * physicalScale,
                        snapThreshold: 0.5 * physicalScale,
                    }
                );

                // The critical assertion: we should never have a situation where
                // both inner and outer chains exist but one is empty while the other has 2+ shapes
                // (which was the symptom of both offsets being classified as the same side)

                const innerShapeCount =
                    offsetResult.innerChain?.shapes.length || 0;
                const outerShapeCount =
                    offsetResult.outerChain?.shapes.length || 0;
                const totalShapes = innerShapeCount + outerShapeCount;

                if (totalShapes > 1) {
                    // If we have multiple offset shapes, they should be distributed across both sides
                    // not concentrated on one side only
                    expect(
                        innerShapeCount,
                        'Inner chain should have shapes when total > 1'
                    ).toBeGreaterThan(0);
                    expect(
                        outerShapeCount,
                        'Outer chain should have shapes when total > 1'
                    ).toBeGreaterThan(0);
                }
            }
        });
    });
});
