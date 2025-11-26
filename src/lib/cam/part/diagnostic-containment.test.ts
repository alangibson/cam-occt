import { describe, expect, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isChainClosed } from '$lib/cam/chain/functions';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { buildContainmentHierarchy } from '$lib/cam/part/geometric-containment';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';

function filterToLargestLayer(shapes: ShapeData[]): ShapeData[] {
    const layerMap = new Map<string, ShapeData[]>();
    shapes.forEach((shape) => {
        const layer = shape.layer || 'NO_LAYER';
        if (!layerMap.has(layer)) {
            layerMap.set(layer, []);
        }
        layerMap.get(layer)!.push(shape);
    });

    let largestLayer = '';
    let maxShapes = 0;
    for (const [layer, layerShapes] of layerMap.entries()) {
        if (layerShapes.length > maxShapes) {
            maxShapes = layerShapes.length;
            largestLayer = layer;
        }
    }

    return layerMap.get(largestLayer) || shapes;
}

describe('Diagnostic - Containment Hierarchy', () => {
    it('diagnose Tractor Light Mount - Left.dxf containment', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        // Filter to largest layer to eliminate circle-only layers
        const filteredShapes = filterToLargestLayer(drawing.shapes);

        const chains = detectShapeChains(
            filteredShapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        console.log('\n========== Tractor Light Mount - Left.dxf ==========');
        console.log(`Total chains: ${chains.length}`);
        console.log(`Closed chains: ${closedChains.length}`);

        // Build containment hierarchy manually
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

        // Identify which chains have no parent (level 0)
        const rootChains = closedChains.filter(
            (chain) => !containmentMap.has(chain.id)
        );
        console.log(`\nRoot chains (level 0): ${rootChains.length}`);
        rootChains.forEach((chain) => {
            console.log(`  ${chain.id} (${chain.shapes.length} shapes)`);
        });

        const partResult = await detectParts(chains, 0.1);

        console.log(`\nParts detected: ${partResult.parts.length}`);
        partResult.parts.forEach((part, idx) => {
            console.log(`\nPart ${idx + 1}:`);
            console.log(
                `  Shell: ${part.shell.id} (${part.shell.shapes.length} shapes)`
            );
            console.log(`  Voids: ${part.voids.length}`);
            part.voids.forEach((void_, vidx) => {
                console.log(
                    `    Void ${vidx + 1}: ${void_.chain.id} (${void_.chain.shapes.length} shapes)`
                );
            });
        });

        // This should be 1 part
        expect(partResult.parts).toHaveLength(1);
    });

    it('diagnose Tractor Seat Mount - Left.dxf containment', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        // Filter to largest layer to eliminate circle-only layers
        const filteredShapes = filterToLargestLayer(drawing.shapes);

        const chains = detectShapeChains(
            filteredShapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        const closedChains = normalizedChains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        console.log('\n========== Tractor Seat Mount - Left.dxf ==========');
        console.log(`Total chains: ${chains.length}`);
        console.log(`Closed chains: ${closedChains.length}`);

        // Build containment hierarchy manually
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

        // Identify which chains have no parent (level 0)
        const rootChains = closedChains.filter(
            (chain) => !containmentMap.has(chain.id)
        );
        console.log(`\nRoot chains (level 0): ${rootChains.length}`);
        rootChains.forEach((chain) => {
            console.log(`  ${chain.id} (${chain.shapes.length} shapes)`);
        });

        const partResult = await detectParts(chains, 0.1);

        console.log(`\nParts detected: ${partResult.parts.length}`);
        partResult.parts.forEach((part, idx) => {
            console.log(`\nPart ${idx + 1}:`);
            console.log(
                `  Shell: ${part.shell.id} (${part.shell.shapes.length} shapes)`
            );
            console.log(`  Voids: ${part.voids.length}`);
            part.voids.forEach((void_, vidx) => {
                console.log(
                    `    Void ${vidx + 1}: ${void_.chain.id} (${void_.chain.shapes.length} shapes)`
                );
            });
        });

        // This should be 1 part
        expect(partResult.parts).toHaveLength(1);
    });
});
