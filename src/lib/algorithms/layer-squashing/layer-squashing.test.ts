/**
 * Layer Squashing Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf-parser';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import {
    squashLayers,
    getLayerStatistics,
    validateSquashing,
} from './layer-squashing';
import { readFileSync } from 'fs';

describe('Layer Squashing Algorithm', () => {
    it('should load Tractor Seat Mount - Left.dxf, squash layers, and detect 13 chains', async () => {
        // 1) Load tests/dxf/Tractor Seat Mount - Left.dxf
        const filePath = 'tests/dxf/Tractor Seat Mount - Left.dxf';
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse DXF without layer squashing first to get original structure
        const originalDrawing = await parseDXF(dxfContent, {
            squashLayers: false,
        });

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

        const originalDrawing = await parseDXF(dxfContent, {
            squashLayers: false,
        });
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

        const originalDrawing = await parseDXF(dxfContent, {
            squashLayers: false,
        });
        const squashedDrawing = squashLayers(originalDrawing);

        const validation = validateSquashing(originalDrawing, squashedDrawing);
        expect(validation.success).toBe(true);

        // Should preserve all shapes even when no separate layers exist
        expect(squashedDrawing.shapes.length).toBeGreaterThan(0);
    });

    it('should preserve layer info when requested', async () => {
        const filePath = 'tests/dxf/Tractor Seat Mount - Left.dxf';
        const dxfContent = readFileSync(filePath, 'utf-8');

        const originalDrawing = await parseDXF(dxfContent, {
            squashLayers: false,
        });
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
            (shape) => shape.metadata?.originalLayer || shape.layer
        );
        expect(shapesWithLayerInfo.length).toBeGreaterThan(0);
    });
});
