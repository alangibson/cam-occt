import { describe, expect, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf-parser';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Chain as ShapeChain } from '$lib/geometry/chain/interfaces';
// Shape and Point2D types not needed in this test

// Helper function to test chain closure (copied from part-detection.ts)
function isChainClosedTest(
    chain: ShapeChain,
    tolerance: number = 0.1
): boolean {
    if (chain.shapes.length === 0) return false;

    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];

    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);

    // Check if the chain is closed (end connects to start within tolerance)
    const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );

    return distance < tolerance;
}

function calculateChainGapDistanceTest(chain: ShapeChain): number {
    if (chain.shapes.length === 0) return 0;

    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];

    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);

    return Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );
}

describe('Part Detection - Tractor Light Mount Issue', () => {
    it('should detect 1 part for Tractor Light Mount - Left.dxf, not 7', async () => {
        // Load the test file
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse the DXF file with layer squashing enabled
        const drawing = await parseDXF(dxfContent, { squashLayers: true });

        // Log shape types for debugging
        const shapeTypes = new Map<string, number>();
        drawing.shapes.forEach((shape) => {
            const count = shapeTypes.get(shape.type) || 0;
            shapeTypes.set(shape.type, count + 1);
        });

        // Use the standard default tolerance (0.1) as would be used from Program page
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });

        // CRITICAL: Normalize chains before analysis (matching part detection behavior)
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        // Detect parts using the same tolerance as chain detection
        const partResult = await detectParts(chains, 0.1);

        normalizedChains.forEach((chain) => {
            isChainClosedTest(chain, 0.1);
            calculateChainGapDistanceTest(chain);
        });

        if (partResult.warnings.length > 0) {
            // Warnings present but not processed in this test
        }

        // FIXED: Spline support has been added to chain detection
        // - Chain detection now properly handles splines for connectivity
        // - Single closed splines are now detected correctly
        // - Result: 16 chains detected (correct!) with 1 shell + 15 holes

        // Verify correct part detection: 1 part with 15 holes
        expect(partResult.parts).toHaveLength(1);
        const part = partResult.parts[0];
        expect(part.shell).toBeDefined();
        expect(part.holes.length).toBe(15); // Now correctly detecting all 15 holes

        // Chain detection is now working correctly - detects all 16 closed chains:
        // - chain-3: shell (14 shapes)
        // - chains 1,2,4-16: all holes (15 holes total)
        // - chain-16 is the large missing hole (39 shapes) that was previously undetected
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosedTest(chain, 0.1)
        );
        expect(closedChains.length).toBe(16); // All 16 chains are now properly detected as closed
    });

    it('should correctly detect 1 part for Tractor Seat Mount - Left.dxf as reference', async () => {
        // Load the working reference file
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse the DXF file with layer squashing enabled
        const drawing = await parseDXF(dxfContent, { squashLayers: true });

        // Use the standard default tolerance (0.1) as would be used from Program page
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });

        // Detect parts using the same tolerance as chain detection
        const partResult = await detectParts(chains, 0.1);

        // CORRECT BEHAVIOR: Should detect 1 part

        // Should detect 1 part as expected
        expect(partResult.parts).toHaveLength(1);
        // const part = partResult.parts[0];
        // expect(part.shell).toBeDefined();
        // expect(part.holes.length).toBeGreaterThan(0);
    });
});
