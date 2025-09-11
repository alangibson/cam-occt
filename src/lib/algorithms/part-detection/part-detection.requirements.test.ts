/**
 * Part Detection Requirements Tests
 *
 * CRITICAL: These tests are based on USER REQUIREMENTS and must NOT be changed
 * without explicit user permission. They define the CORRECT expected behavior.
 *
 * DO NOT modify test expectations to make tests pass - fix the code instead.
 *
 * Test procedure:
 * - Load DXF file
 * - Detect chains
 * - Normalize chains
 * - Detect parts
 */

import { describe, it, expect } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf-parser';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { type Chain } from '$lib/geometry/chain/interfaces';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import { readFileSync } from 'fs';
import { join } from 'path';
import { detectParts, type PartHole } from './part-detection';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';

describe('Part Detection Requirements - USER SPECIFIED EXPECTATIONS', () => {
    // CRITICAL: Never remove these tests nor change expectations without user permission

    it('1.dxf: should detect 2 closed chains, 2 parts', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/1.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Load DXF file
        const drawing = await parseDXF(dxfContent, { squashLayers: true });

        // Detect chains
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });

        // Normalize chains
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        // Detect parts
        const partResult = await detectParts(chains, 0.1);

        // Count closed chains after normalization
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 2 closed chains, 2 parts
        expect(closedChains).toHaveLength(2);
        expect(partResult.parts).toHaveLength(2);
    });

    it('2.dxf: should detect 2 closed chains, 2 parts', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/2.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 2 closed chains, 2 parts
        expect(closedChains).toHaveLength(2);
        expect(partResult.parts).toHaveLength(2);
    });

    it('3.dxf: should detect 2 closed chains, 2 parts', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/3.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 2 closed chains, 2 parts
        expect(closedChains).toHaveLength(2);
        expect(partResult.parts).toHaveLength(2);
    });

    it('1997.dxf: should detect 6 closed chains, 4 parts', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/1997.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 6 closed chains, 4 parts
        expect(closedChains).toHaveLength(6);
        expect(partResult.parts).toHaveLength(4);
    });

    it('2013-11-08_test.dxf: should detect 4 closed chains, 1 part', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/2013-11-08_test.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 4 closed chains, 1 part
        expect(closedChains).toHaveLength(4);
        expect(partResult.parts).toHaveLength(1);
    });

    it('ADLER.dxf: should detect 10 closed chains, 9 parts', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 10 closed chains, 9 parts
        expect(closedChains).toHaveLength(10);
        expect(partResult.parts).toHaveLength(9);
    });

    it('Tractor Light Mount - Left.dxf: should detect 16 closed chains, 1 part', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 16 closed chains, 1 part
        expect(closedChains).toHaveLength(16);
        expect(partResult.parts).toHaveLength(1);
    });

    it('ATT00079.dxf: should detect 96 closed chains, 21 parts', async () => {
        const filePath = join(process.cwd(), 'tests/dxf/ATT00079.dxf');
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        // Count closed chains by detecting which chains became parts or holes
        const closedChainIds = new Set<string>();
        partResult.parts.forEach((part) => {
            closedChainIds.add(part.shell.chain.id);
            const addHoles = (holes: PartHole[]) => {
                holes.forEach((hole) => {
                    closedChainIds.add(hole.chain.id);
                    addHoles(hole.holes);
                });
            };
            addHoles(part.holes);
        });
        const closedChains = normalizedChains.filter((chain) =>
            closedChainIds.has(chain.id)
        );

        // USER REQUIREMENTS: 96 closed chains, 21 parts
        expect(closedChains).toHaveLength(96);
        expect(partResult.parts).toHaveLength(21);
    });

    it('Tractor Seat Mount - Left.dxf: should detect 13 closed chains, 1 part', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        const drawing = await parseDXF(dxfContent, { squashLayers: true });
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));
        const partResult = await detectParts(chains, 0.1);
        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // USER REQUIREMENTS: 13 closed chains, 1 part
        expect(closedChains).toHaveLength(13);
        expect(partResult.parts).toHaveLength(1);
    });
});

// Helper function to check if chain is closed (copied from part-detection.ts)
function isChainClosed(chain: Chain, tolerance: number = 0.1): boolean {
    if (chain.shapes.length === 0) return false;

    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];

    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);

    const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );

    return distance < tolerance;
}
