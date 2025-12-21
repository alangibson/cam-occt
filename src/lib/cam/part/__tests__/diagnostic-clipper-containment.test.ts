import { describe, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isChainClosed } from '$lib/cam/chain/functions';
import { isChainContainedInChain_Clipper2 } from '$lib/cam/chain/chain-containment';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { Shape } from '$lib/cam/shape/classes';

describe('Diagnostic - Clipper2 Containment', () => {
    it('test Clipper2 containment for small circle chains in Tractor Light Mount', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        const chains = detectShapeChains(
            drawing.shapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        const chain1 = closedChains.find((c) => c.id === 'chain-1');
        const chain2 = closedChains.find((c) => c.id === 'chain-2');
        const chain3 = closedChains.find((c) => c.id === 'chain-3');

        console.log(
            '\n========== Clipper2 Containment Test - Tractor Light Mount =========='
        );

        if (chain1 && chain3) {
            const isContained = isChainContainedInChain_Clipper2(
                chain1,
                chain3
            );
            console.log(
                `\nchain-1 (${chain1.shapes.map((s) => s.type).join(', ')}) contained in chain-3: ${isContained}`
            );
            console.log(
                `  Expected: true (point-in-chain confirmed it's inside)`
            );
        }

        if (chain2 && chain3) {
            const isContained = isChainContainedInChain_Clipper2(
                chain2,
                chain3
            );
            console.log(
                `\nchain-2 (${chain2.shapes.map((s) => s.type).join(', ')}) contained in chain-3: ${isContained}`
            );
            console.log(
                `  Expected: true (point-in-chain confirmed it's inside)`
            );
        }
    });

    it('test Clipper2 containment for small circle chains in Tractor Seat Mount', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        const chains = detectShapeChains(
            drawing.shapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        const chain1 = closedChains.find((c) => c.id === 'chain-1');
        const chain2 = closedChains.find((c) => c.id === 'chain-2');
        const chain3 = closedChains.find((c) => c.id === 'chain-3');
        const chain4 = closedChains.find((c) => c.id === 'chain-4');
        const chain5 = closedChains.find((c) => c.id === 'chain-5');

        console.log(
            '\n========== Clipper2 Containment Test - Tractor Seat Mount =========='
        );

        for (const [idx, chain] of [
            [1, chain1],
            [2, chain2],
            [3, chain3],
            [4, chain4],
        ] as const) {
            if (chain && chain5) {
                const isContained = isChainContainedInChain_Clipper2(
                    chain,
                    chain5
                );
                console.log(
                    `\nchain-${idx} (${chain.shapes.map((s) => s.type).join(', ')}) contained in chain-5: ${isContained}`
                );
                console.log(
                    `  Expected: true (point-in-chain confirmed it's inside)`
                );
            }
        }
    });
});
