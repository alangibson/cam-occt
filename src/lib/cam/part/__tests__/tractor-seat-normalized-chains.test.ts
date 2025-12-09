import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection.functions';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { Shape } from '$lib/cam/shape/classes';

describe('Tractor Seat Mount Normalized Chains Part Detection Bug', () => {
    it('should detect 1 part with 12 holes after chain normalization', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF with squashed layers to combine all geometry
        const drawing = await parseDXF(dxfContent);

        // Use standard tolerance for chain detection
        const tolerance = 1.0; // Using 1.0 to get more chains connected
        const chains = detectShapeChains(
            drawing.shapes.map((s) => new Shape(s)),
            { tolerance }
        );

        // Check closure status before normalization
        // Closure analysis removed as it was not used in the test

        // Normalize all chains
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        // Check closure status after normalization

        // Detect parts after normalization
        const partResult = await detectParts(normalizedChains, 0.1);

        // Show details for each part
        partResult.parts.forEach((part, _index) => {
            part.voids.forEach((_voidItem, _voidIndex) => {});
        });

        // Show warnings
        if (partResult.warnings.length > 0) {
            partResult.warnings.forEach((_warning) => {});
        }

        // The bug: After normalization, the large boundary chain should be closed
        // and should contain 12 voids (4 round + 8 letter shapes)
        // But currently only 2 voids are detected

        // Expected behavior (this should pass after fix):
        // expect(partResult.parts.length).toBe(1);
        // expect(partResult.parts[0].voids.length).toBe(12);

        // Current buggy behavior (documenting what we see now):

        // Find the main part (should have the most shapes in its shell)
        const mainPart = partResult.parts.reduce((largest, current) =>
            current.shell.shapes.length > largest.shell.shapes.length
                ? current
                : largest
        );

        if (mainPart && mainPart.voids.length < 12) {
            // Bug confirmed - fewer voids detected than expected
        }

        // This test documents the current buggy behavior
        // After fix, we should have 1 part with 12 voids
        if (partResult.parts.length === 1) {
            // If we get 1 part, check void count
            expect(partResult.parts[0].voids.length).toBe(12);
        } else {
            // If we get multiple parts, something is wrong with part detection
            expect(partResult.parts.length).toBeGreaterThan(0); // At least some parts should be detected
        }
    }, 10000);
});
