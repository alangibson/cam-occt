import { describe, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isChainClosed } from '$lib/cam/chain/functions';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { buildContainmentHierarchy } from '$lib/cam/part/geometric-containment';
import { Shape } from '$lib/cam/shape/classes';

describe('Diagnostic - Part Detection Without Duplicate Layers', () => {
    it('diagnose Tractor Light Mount without layer 0 duplicates', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        // Filter out layer "0" to remove duplicates
        const filteredShapes = drawing.shapes.filter((s) => s.layer !== '0');

        console.log('\n========== Tractor Light Mount (No Layer 0) ==========');
        console.log(`Original shapes: ${drawing.shapes.length}`);
        console.log(`Filtered shapes: ${filteredShapes.length}`);

        const chains = detectShapeChains(
            filteredShapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        console.log(`Total chains: ${chains.length}`);
        console.log(`Closed chains: ${closedChains.length}`);

        // Build containment hierarchy
        const containmentMap = await buildContainmentHierarchy(
            closedChains,
            0.1
        );

        console.log(`\nContainment relationships: ${containmentMap.size}`);
        for (const [childId, parentId] of containmentMap.entries()) {
            const child = closedChains.find((c) => c.id === childId);
            const parent = closedChains.find((c) => c.id === parentId);
            console.log(
                `  ${childId} (${child?.shapes.length} shapes) -> ${parentId} (${parent?.shapes.length} shapes)`
            );
        }

        const rootChains = closedChains.filter(
            (chain) => !containmentMap.has(chain.id)
        );
        console.log(`\nRoot chains (level 0): ${rootChains.length}`);
        rootChains.forEach((chain) => {
            console.log(
                `  ${chain.id} (${chain.shapes.length} shapes, types: ${chain.shapes.map((s) => s.type).join(',')})`
            );
        });

        const partResult = await detectParts(chains, 0.1);

        console.log(`\nParts detected: ${partResult.parts.length}`);
        partResult.parts.forEach((part, idx) => {
            console.log(`\nPart ${idx + 1}:`);
            console.log(
                `  Shell: ${part.shell.id} (${part.shell.shapes.length} shapes)`
            );
            console.log(`  Voids: ${part.voids.length}`);
        });
    });

    it('diagnose Tractor Seat Mount without layer 0 duplicates', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        // Filter out layer "0" to remove duplicates
        const filteredShapes = drawing.shapes.filter((s) => s.layer !== '0');

        console.log('\n========== Tractor Seat Mount (No Layer 0) ==========');
        console.log(`Original shapes: ${drawing.shapes.length}`);
        console.log(`Filtered shapes: ${filteredShapes.length}`);

        const chains = detectShapeChains(
            filteredShapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        console.log(`Total chains: ${chains.length}`);
        console.log(`Closed chains: ${closedChains.length}`);

        // Build containment hierarchy
        const containmentMap = await buildContainmentHierarchy(
            closedChains,
            0.1
        );

        console.log(`\nContainment relationships: ${containmentMap.size}`);
        for (const [childId, parentId] of containmentMap.entries()) {
            const child = closedChains.find((c) => c.id === childId);
            const parent = closedChains.find((c) => c.id === parentId);
            console.log(
                `  ${childId} (${child?.shapes.length} shapes) -> ${parentId} (${parent?.shapes.length} shapes)`
            );
        }

        const rootChains = closedChains.filter(
            (chain) => !containmentMap.has(chain.id)
        );
        console.log(`\nRoot chains (level 0): ${rootChains.length}`);
        rootChains.forEach((chain) => {
            console.log(
                `  ${chain.id} (${chain.shapes.length} shapes, types: ${chain.shapes.map((s) => s.type).join(',')})`
            );
        });

        const partResult = await detectParts(chains, 0.1);

        console.log(`\nParts detected: ${partResult.parts.length}`);
        partResult.parts.forEach((part, idx) => {
            console.log(`\nPart ${idx + 1}:`);
            console.log(
                `  Shell: ${part.shell.id} (${part.shell.shapes.length} shapes)`
            );
            console.log(`  Voids: ${part.voids.length}`);
        });
    });
});
