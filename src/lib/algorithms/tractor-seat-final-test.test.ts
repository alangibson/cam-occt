import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '$lib/parsers/dxf-parser';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';

describe('Tractor Seat Mount Final Test', () => {
    it('should detect 1 part with multiple holes after gap closing fix', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF with squashed layers to combine all geometry
        const drawing = await parseDXF(dxfContent, {
            decomposePolylines: true,
            translateToPositiveQuadrant: true,
            squashLayers: true,
        });

        // Detect chains
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.05 });

        // Detect parts
        const partResult = await detectParts(chains);

        partResult.parts.forEach((part) => {
            part.holes.forEach(() => {});
        });

        if (partResult.warnings.length > 0) {
            // Warnings detected but proceeding with test
        }

        // The expected behavior: 1 part with multiple holes
        expect(partResult.parts.length).toBe(1);
        expect(partResult.parts[0].holes.length).toBeGreaterThan(0);

        // The largest chain should be the shell
        const shellChain = partResult.parts[0].shell.chain;
        expect(shellChain.shapes.length).toBe(42); // The large boundary chain
    }, 10000);
});
