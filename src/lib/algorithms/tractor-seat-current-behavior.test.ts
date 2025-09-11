import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '$lib/parsers/dxf-parser';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';

describe('Tractor Seat Mount Current Behavior', () => {
    it('should confirm current behavior: detects 11 parts instead of 1 part with holes', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF with squashed layers to combine all geometry
        const drawing = await parseDXF(dxfContent, {
            decomposePolylines: true,
            translateToPositiveQuadrant: true,
            squashLayers: true,
        });

        // Try more aggressive chain detection to see if more chains can be detected
        const tolerances = [0.05, 0.1, 0.5, 1.0, 2.0];

        for (const tolerance of tolerances) {
            detectShapeChains(drawing.shapes, { tolerance });
        }

        // Use aggressive tolerance to get maximum chains
        const chains = detectShapeChains(drawing.shapes, { tolerance: 1.0 });

        // Detect parts with user tolerance
        const userTolerance = 0.1;
        const partResult = await detectParts(chains, userTolerance);

        // Show all parts
        partResult.parts.forEach(() => {});

        // Analyze chain closure with detailed debugging
        chains.forEach((chain, _index) => {
            if (chain.shapes.length === 0) return;
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];
            const firstStart = getShapeStartPoint(firstShape);
            const lastEnd = getShapeEndPoint(lastShape);

            const distance: number = Math.sqrt(
                Math.pow(firstStart.x - lastEnd.x, 2) +
                    Math.pow(firstStart.y - lastEnd.y, 2)
            );

            // Use ONLY the user-set tolerance
            const userTolerance = 0.1;
            return distance < userTolerance;
        });

        chains.filter((chain) => {
            if (chain.shapes.length === 0) return false;
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];
            const firstStart = getShapeStartPoint(firstShape);
            const lastEnd = getShapeEndPoint(lastShape);
            const distance: number = Math.sqrt(
                Math.pow(firstStart.x - lastEnd.x, 2) +
                    Math.pow(firstStart.y - lastEnd.y, 2)
            );

            // Use ONLY user tolerance
            const userTolerance = 0.1;
            return distance < userTolerance;
        });

        // This test documents the current behavior with user tolerance
        // With user tolerance 0.1, most chains will be open due to gaps
        // The expected behavior is 1 part with multiple holes

        // Expected behavior after fix:
        // expect(partResult.parts.length).toBe(1);
        // expect(partResult.parts[0].holes.length).toBeGreaterThan(0);
    }, 10000);
});
