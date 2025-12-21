import { describe, expect, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection.functions';
import fs from 'fs';
import path from 'path';
import { Shape } from '$lib/cam/shape/classes';

describe('1997.dxf Part Detection', () => {
    it('should detect 6 chains and 4 parts from the 1997.dxf file', async () => {
        // Read the DXF file
        const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
        const dxfContent = fs.readFileSync(dxfPath, 'utf8');

        // Parse DXF (no decomposition in parser)
        const parsed = await parseDXF(dxfContent);

        // Decompose polylines separately
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );

        // Verify we have the expected number of shapes after decomposition
        expect(decomposed.length).toBeGreaterThan(400); // Should have ~454 line segments

        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));

        // Detect chains using decomposed shapes
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });

        // Log chain details
        chains.forEach(() => {});

        // Detect parts
        const partResult = detectParts(chains);

        // Log part details
        partResult.parts.forEach(() => {});

        // Log warnings if any
        if (partResult.warnings.length > 0) {
            partResult.warnings.forEach(() => {});
        }

        // Assertions
        expect(chains.length).toBe(6); // Expected: 6 chains
        expect(partResult.parts.length).toBe(4); // Expected: 4 parts
        expect(decomposed.length).toBeGreaterThan(0); // Should have shapes after decomposition

        // Additional validation: total holes across all parts
        const totalHoles = partResult.parts.reduce(
            (sum, part) => sum + part.voids.length,
            0
        );

        // Since we have 6 chains and 4 parts, we should have 2 holes total (6 - 4 = 2)
        expect(totalHoles).toBe(2);
    });

    it('should process the 1997.dxf file without errors', async () => {
        const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
        const dxfContent = fs.readFileSync(dxfPath, 'utf8');

        // DXF parsing should not throw
        const parsed = await parseDXF(dxfContent);
        expect(parsed).toBeDefined();
        expect(parsed.shapes).toBeDefined();

        // Polyline decomposition should not throw
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );
        expect(decomposed).toBeDefined();
        expect(Array.isArray(decomposed)).toBe(true);

        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));

        // Chain detection should not throw
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });
        expect(chains).toBeDefined();
        expect(Array.isArray(chains)).toBe(true);

        // Part detection should not throw
        const partResult = detectParts(chains);
        expect(partResult).toBeDefined();
        expect(partResult.parts).toBeDefined();
        expect(partResult.warnings).toBeDefined();
    });
});
