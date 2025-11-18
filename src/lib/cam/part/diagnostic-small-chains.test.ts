import { describe, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isChainClosed } from '$lib/geometry/chain/functions';
import { normalizeChain } from '$lib/geometry/chain/chain-normalization';
import { getShapeStartPoint } from '$lib/geometry/shape/functions';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';
import { isPointInsideChainExact } from '$lib/geometry/chain/point-in-chain';

describe('Diagnostic - Small Chains Analysis', () => {
    it('analyze small chains in Tractor Light Mount', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        console.log(
            '\n========== Tractor Light Mount - Small Chains =========='
        );

        // Find chain-1, chain-2, and chain-3
        const chain1 = closedChains.find((c) => c.id === 'chain-1');
        const chain2 = closedChains.find((c) => c.id === 'chain-2');
        const chain3 = closedChains.find((c) => c.id === 'chain-3');

        if (chain1) {
            console.log(`\nchain-1: ${chain1.shapes.length} shapes`);
            const bbox = calculateChainBoundingBox(chain1);
            console.log(
                `  BBox: (${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}) to (${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)})`
            );
            console.log(
                `  Shape types: ${chain1.shapes.map((s) => s.type).join(', ')}`
            );

            // Check if first point of chain-1 is inside chain-3
            if (chain3 && chain1.shapes.length > 0) {
                const point = getShapeStartPoint(chain1.shapes[0]);
                const inside = isPointInsideChainExact(point, chain3);
                console.log(`  First point inside chain-3: ${inside}`);
            }
        }

        if (chain2) {
            console.log(`\nchain-2: ${chain2.shapes.length} shapes`);
            const bbox = calculateChainBoundingBox(chain2);
            console.log(
                `  BBox: (${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}) to (${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)})`
            );
            console.log(
                `  Shape types: ${chain2.shapes.map((s) => s.type).join(', ')}`
            );

            // Check if first point of chain-2 is inside chain-3
            if (chain3 && chain2.shapes.length > 0) {
                const point = getShapeStartPoint(chain2.shapes[0]);
                const inside = isPointInsideChainExact(point, chain3);
                console.log(`  First point inside chain-3: ${inside}`);
            }
        }

        if (chain3) {
            console.log(`\nchain-3: ${chain3.shapes.length} shapes`);
            const bbox = calculateChainBoundingBox(chain3);
            console.log(
                `  BBox: (${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}) to (${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)})`
            );
            console.log(
                `  Shape types: ${chain3.shapes.map((s) => s.type).join(', ')}`
            );
        }
    });

    it('analyze small chains in Tractor Seat Mount', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        console.log(
            '\n========== Tractor Seat Mount - Small Chains =========='
        );

        // Find the small chains and chain-5
        const chain1 = closedChains.find((c) => c.id === 'chain-1');
        const chain2 = closedChains.find((c) => c.id === 'chain-2');
        const chain3 = closedChains.find((c) => c.id === 'chain-3');
        const chain4 = closedChains.find((c) => c.id === 'chain-4');
        const chain5 = closedChains.find((c) => c.id === 'chain-5');

        for (const chain of [chain1, chain2, chain3, chain4]) {
            if (chain) {
                console.log(`\n${chain.id}: ${chain.shapes.length} shapes`);
                const bbox = calculateChainBoundingBox(chain);
                console.log(
                    `  BBox: (${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}) to (${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)})`
                );
                console.log(
                    `  Shape types: ${chain.shapes.map((s) => s.type).join(', ')}`
                );

                // Check if first point is inside chain-5
                if (chain5 && chain.shapes.length > 0) {
                    const point = getShapeStartPoint(chain.shapes[0]);
                    const inside = isPointInsideChainExact(point, chain5);
                    console.log(`  First point inside chain-5: ${inside}`);
                }
            }
        }

        if (chain5) {
            console.log(`\nchain-5: ${chain5.shapes.length} shapes`);
            const bbox = calculateChainBoundingBox(chain5);
            console.log(
                `  BBox: (${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}) to (${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)})`
            );
            console.log(
                `  Shape types: ${chain5.shapes.map((s) => s.type).join(', ')}`
            );
        }
    });
});
