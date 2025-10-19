/**
 * Layer Squashing Algorithm Tests
 */

import { describe, expect, it } from 'vitest';
import { GeometryType } from '$lib/geometry/shape/enums';
import { Unit } from '$lib/config/units/units';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Geometry } from '$lib/geometry/shape/types';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import {
    getLayerStatistics,
    squashLayers,
    validateSquashing,
} from './layer-squashing';
import { readFileSync } from 'fs';

describe('Layer Squashing Algorithm', () => {
    it('should load Tractor Seat Mount - Left.dxf, squash layers, and detect 13 chains', async () => {
        // 1) Load tests/dxf/Tractor Seat Mount - Left.dxf
        const filePath = 'tests/dxf/Tractor Seat Mount - Left.dxf';
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse DXF without layer squashing first to get original structure
        const originalDrawing = await parseDXF(dxfContent);

        // Get layer statistics before squashing
        const layerStats = getLayerStatistics(originalDrawing);
        console.log('Original layer statistics:', layerStats);

        // 2) Squash layers with duplicate elimination
        const squashedDrawing = squashLayers(originalDrawing, {
            tolerance: 0.1,
        });

        // Validate that 4 duplicate circles were eliminated (209 -> 205)
        const originalShapeCount = layerStats.totalShapes;
        const finalShapeCount = squashedDrawing.shapes?.length || 0;

        console.log(
            `Shape count reduction: ${originalShapeCount} -> ${finalShapeCount} (eliminated ${originalShapeCount - finalShapeCount} duplicates)`
        );

        // Should eliminate 4 duplicate circles
        expect(originalShapeCount).toBe(209);
        expect(finalShapeCount).toBe(205);
        expect(originalShapeCount - finalShapeCount).toBe(4);

        // Detect chains on squashed drawing
        const chains = detectShapeChains(squashedDrawing.shapes, {
            tolerance: 0.1,
        });

        console.log(`Detected ${chains.length} chains after layer squashing`);
        console.log(
            'Chain details:',
            chains.map((chain) => ({
                id: chain.id,
                shapeCount: chain.shapes.length,
            }))
        );

        // 3) Assert that there are 13 chains
        expect(chains).toHaveLength(13);
    });

    it('should eliminate duplicate shapes when squashing layers', async () => {
        // Test with a known multi-layer file that has duplicates
        const filePath = 'tests/dxf/Tractor Seat Mount - Left.dxf';
        const dxfContent = readFileSync(filePath, 'utf-8');

        const originalDrawing = await parseDXF(dxfContent);
        const squashedDrawing = squashLayers(originalDrawing, {
            tolerance: 0.1,
        });

        const originalStats = getLayerStatistics(originalDrawing);
        const squashedShapeCount = squashedDrawing.shapes?.length || 0;

        console.log(`Original total shapes: ${originalStats.totalShapes}`);
        console.log(`Squashed shape count: ${squashedShapeCount}`);
        console.log(
            `Eliminated duplicates: ${originalStats.totalShapes - squashedShapeCount}`
        );
        console.log('Layer breakdown:', originalStats.layerCounts);

        // Should eliminate duplicate shapes (4 duplicate circles)
        expect(originalStats.totalShapes).toBe(209);
        expect(squashedShapeCount).toBe(205);
        expect(originalStats.totalShapes - squashedShapeCount).toBe(4);

        // Squashed drawing should have no separate layers
        expect(squashedDrawing.layers).toBeUndefined();
    });

    it('should handle drawings with no layers gracefully', async () => {
        // Test with a single-layer file
        const filePath = 'tests/dxf/1.dxf';
        const dxfContent = readFileSync(filePath, 'utf-8');

        const originalDrawing = await parseDXF(dxfContent);
        const squashedDrawing = squashLayers(originalDrawing);

        const validation = validateSquashing(originalDrawing, squashedDrawing);
        expect(validation.success).toBe(true);

        // Should preserve all shapes even when no separate layers exist
        expect(squashedDrawing.shapes.length).toBeGreaterThan(0);
    });

    it('should preserve layer info when requested', async () => {
        const filePath = 'tests/dxf/Tractor Seat Mount - Left.dxf';
        const dxfContent = readFileSync(filePath, 'utf-8');

        const originalDrawing = await parseDXF(dxfContent);
        const squashedDrawing = squashLayers(originalDrawing, {
            preserveLayerInfo: true,
        });

        // If file has no separate layers, layer preservation should still work gracefully
        if (
            originalDrawing.layers &&
            Object.keys(originalDrawing.layers).length > 0
        ) {
            expect(squashedDrawing.layers).toBeDefined();
        }

        // All shapes should have layer information (either from original layer or shape.layer)
        const shapesWithLayerInfo = squashedDrawing.shapes.filter(
            (shape: Shape) => shape.metadata?.originalLayer || shape.layer
        );
        expect(shapesWithLayerInfo.length).toBeGreaterThan(0);
    });

    describe('Edge Cases and Branch Coverage', () => {
        it('should handle drawing with no main shapes but with layer shapes', () => {
            const drawing = {
                shapes: [] as Shape[],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
                layers: {
                    layer1: {
                        shapes: [
                            {
                                id: 'shape1',
                                type: GeometryType.CIRCLE,
                                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                            },
                        ],
                    },
                },
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(1);
            expect(result.shapes[0].layer).toBe('layer1');
        });

        it('should handle drawing with empty shapes array', () => {
            const drawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
                layers: {
                    layer1: {
                        shapes: [
                            {
                                id: 'shape1',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 0, y: 0 },
                                    end: { x: 10, y: 0 },
                                },
                            },
                        ],
                    },
                },
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(1);
        });

        it('should handle layers with empty shapes arrays', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'shape1',
                        type: GeometryType.CIRCLE,
                        geometry: { center: { x: 0, y: 0 }, radius: 5 },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
                layers: {
                    emptyLayer: { shapes: [] },
                    undefinedLayer: { shapes: [] as Shape[] },
                },
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(1);
        });

        it('should handle drawing with no layers property', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'shape1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing);
            expect(result.shapes).toHaveLength(1);
            expect(result.layers).toBeUndefined();
        });

        it('should handle drawing with existing shape metadata when preserving layer info', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'shape1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                        layer: 'originalLayer',
                        metadata: { existingProperty: 'value' },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { preserveLayerInfo: true });
            expect(result.shapes[0].metadata?.existingProperty).toBe('value');
            expect(result.shapes[0].metadata?.originalLayer).toBe(
                'originalLayer'
            );
            expect(result.layers).toBeUndefined(); // No separate layers in original
        });

        it('should remove duplicate shapes correctly', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'shape1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: 'shape2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        }, // Exact duplicate
                    },
                    {
                        id: 'shape3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0.01 },
                        }, // Within tolerance
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(1); // Should keep only first shape
        });

        it('should handle shapes with unknown types as not equal', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'shape1',
                        type: 'unknown' as GeometryType,
                        geometry: { data: 'test' } as unknown as Geometry,
                    },
                    {
                        id: 'shape2',
                        type: 'unknown' as GeometryType,
                        geometry: { data: 'test' } as unknown as Geometry, // Same but unknown type
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(2); // Should keep both since unknown types are not considered equal
        });

        it('should handle different shape types as not equal', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'shape1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: 'shape2',
                        type: GeometryType.CIRCLE,
                        geometry: { center: { x: 5, y: 0 }, radius: 5 },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(2); // Should keep both different types
        });

        it('should handle arc comparison with different clockwise values', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'arc1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 0, y: 0 },
                            radius: 5,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: true,
                        },
                    },
                    {
                        id: 'arc2',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 0, y: 0 },
                            radius: 5,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false, // Different clockwise value
                        },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(2); // Should keep both since clockwise differs
        });

        it('should handle polyline comparison with different vertex counts', () => {
            const drawing = {
                shapes: [
                    {
                        id: 'poly1',
                        type: GeometryType.POLYLINE,
                        geometry: {
                            closed: false,
                            shapes: [
                                {
                                    id: 'seg1',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 0, y: 0 },
                                        end: { x: 5, y: 0 },
                                    },
                                },
                                {
                                    id: 'seg2',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 5, y: 0 },
                                        end: { x: 10, y: 0 },
                                    },
                                },
                            ],
                        },
                    },
                    {
                        id: 'poly2',
                        type: GeometryType.POLYLINE,
                        geometry: {
                            closed: false,
                            shapes: [
                                {
                                    id: 'seg1',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 0, y: 0 },
                                        end: { x: 10, y: 0 },
                                    },
                                },
                            ],
                        },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(2); // Should keep both since vertex counts differ
        });

        it('should handle lines in reverse direction as equal', () => {
            const drawing = {
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
                        }, // Reversed
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = squashLayers(drawing, { tolerance: 0.1 });
            expect(result.shapes).toHaveLength(1); // Should keep only one since they're equivalent
        });

        it('should handle validateSquashing success case', () => {
            const originalDrawing = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
                layers: {
                    layer1: {
                        shapes: [
                            {
                                id: '2',
                                type: GeometryType.CIRCLE,
                                geometry: { center: { x: 5, y: 5 }, radius: 3 },
                            },
                        ],
                    },
                },
            };

            const squashedDrawing = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: '2',
                        type: GeometryType.CIRCLE,
                        geometry: { center: { x: 5, y: 5 }, radius: 3 },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = validateSquashing(originalDrawing, squashedDrawing);
            expect(result.success).toBe(true);
            expect(result.originalShapeCount).toBe(2);
            expect(result.squashedShapeCount).toBe(2);
            expect(result.message).toContain('successful');
        });

        it('should handle validateSquashing failure case', () => {
            const originalDrawing = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
                layers: {
                    layer1: {
                        shapes: [
                            {
                                id: '2',
                                type: GeometryType.CIRCLE,
                                geometry: { center: { x: 5, y: 5 }, radius: 3 },
                            },
                        ],
                    },
                },
            };

            const squashedDrawing = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ], // Missing one shape
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = validateSquashing(originalDrawing, squashedDrawing);
            expect(result.success).toBe(false);
            expect(result.originalShapeCount).toBe(2);
            expect(result.squashedShapeCount).toBe(1);
            expect(result.message).toContain('mismatch');
        });

        it('should handle getLayerStatistics with no layers', () => {
            const drawing = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const result = getLayerStatistics(drawing);
            expect(result.totalShapes).toBe(1);
            expect(result.mainShapes).toBe(1);
            expect(result.layerCounts).toEqual({});
            expect(result.layerNames).toEqual([]);
        });

        it('should handle getLayerStatistics with no main shapes', () => {
            const drawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
                layers: {
                    layer1: {
                        shapes: [
                            {
                                id: '1',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 0, y: 0 },
                                    end: { x: 10, y: 0 },
                                },
                            },
                        ],
                    },
                    layer2: { shapes: [] as Shape[] },
                },
            };

            const result = getLayerStatistics(drawing);
            expect(result.totalShapes).toBe(1);
            expect(result.mainShapes).toBe(0);
            expect(result.layerCounts.layer1).toBe(1);
            expect(result.layerCounts.layer2).toBe(0);
        });
    });
});
