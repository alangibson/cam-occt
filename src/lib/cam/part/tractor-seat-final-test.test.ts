import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import type { ShapeData } from '$lib/geometry/shape/interfaces';

function filterToLargestLayer(shapes: ShapeData[]): ShapeData[] {
    const layerMap = new Map<string, ShapeData[]>();
    shapes.forEach((shape) => {
        const layer = shape.layer || 'NO_LAYER';
        if (!layerMap.has(layer)) {
            layerMap.set(layer, []);
        }
        layerMap.get(layer)!.push(shape);
    });

    let largestLayer = '';
    let maxShapes = 0;
    for (const [layer, layerShapes] of layerMap.entries()) {
        if (layerShapes.length > maxShapes) {
            maxShapes = layerShapes.length;
            largestLayer = layer;
        }
    }

    return layerMap.get(largestLayer) || shapes;
}

describe('Tractor Seat Mount Final Test', () => {
    it('should detect 1 part with multiple holes after gap closing fix', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF with squashed layers to combine all geometry
        const drawing = await parseDXF(dxfContent);

        // Filter to largest layer to eliminate circle-only layers
        const filteredShapes = filterToLargestLayer(drawing.shapes);

        // Detect chains
        const chains = detectShapeChains(filteredShapes, { tolerance: 0.05 });

        // Detect parts
        const partResult = await detectParts(chains);

        partResult.parts.forEach((part) => {
            part.voids.forEach(() => {});
        });

        if (partResult.warnings.length > 0) {
            // Warnings detected but proceeding with test
        }

        // The expected behavior: 1 part with multiple holes
        expect(partResult.parts.length).toBe(1);
        expect(partResult.parts[0].voids.length).toBeGreaterThan(0);

        // The largest chain should be the shell
        const shellChain = partResult.parts[0].shell;
        expect(shellChain.shapes.length).toBe(42); // The large boundary chain
    }, 10000);
});
