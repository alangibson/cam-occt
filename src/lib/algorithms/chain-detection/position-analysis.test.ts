import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';

describe('Position Analysis - Chain-7 vs Chain-13 Location', () => {
    it('should analyze the position difference between chain-7 and chain-13 relative to boundary', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF
        const drawing = await parseDXF(dxfContent);

        // Detect chains
        const tolerance = 1.0;
        const chains = detectShapeChains(drawing.shapes, { tolerance });

        // Normalize chains
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        // Find the specific chains
        const boundaryChain = normalizedChains.find(
            (chain) => chain.shapes.length === 42
        );
        const chain7 = normalizedChains.find((chain) => chain.id === 'chain-7');
        const chain13 = normalizedChains.find(
            (chain) => chain.id === 'chain-13'
        );

        expect(boundaryChain).toBeDefined();
        expect(chain7).toBeDefined();
        expect(chain13).toBeDefined();

        // Calculate bounding boxes
        const boundaryBox = calculateChainBoundingBox(boundaryChain!);
        const chain13Box = calculateChainBoundingBox(chain13!);

        // Check if both shapes are identical in X but different in Y

        if (chain13Box.min.y < boundaryBox.min.y) {
            // Chain 13 extends below boundary
        }

        if (chain13Box.max.y > boundaryBox.max.y) {
            // Chain 13 extends above boundary
        }
    }, 10000);
});
