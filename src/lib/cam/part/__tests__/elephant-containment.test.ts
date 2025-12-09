import { describe, it, expect } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection.functions';
import { getShapeStartPoint, getShapeEndPoint } from '$lib/cam/shape/functions';
import { isPointInsideChainExact } from '$lib/cam/chain/point-in-chain';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { Shape } from '$lib/cam/shape/classes';

describe('Elephant DXF - Chain Containment Issue', () => {
    it('should detect chain-18 as inside part shell chain-1', async () => {
        // Load the actual DXF file
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/non-free/Elephant and baby.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF
        const drawing = await parseDXF(dxfContent);
        console.log('Drawing parsed, shapes:', drawing.shapes.length);

        // Detect chains
        const tolerance = 0.01;
        const chains = detectShapeChains(
            drawing.shapes.map((s) => new Shape(s)),
            { tolerance }
        );
        console.log('Chains detected:', chains.length);

        // Find the specific chains mentioned in the issue
        const chain1 = chains.find((c) => c.name === '1');
        const chain18 = chains.find((c) => c.name === '18');

        if (!chain1) {
            console.log(
                'Available chain names:',
                chains.map((c) => c.name)
            );
            throw new Error('chain with name "1" not found');
        }

        if (!chain18) {
            console.log(
                'Available chain names:',
                chains.map((c) => c.name)
            );
            throw new Error('chain with name "18" not found');
        }

        console.log('chain-1:', {
            id: chain1.id,
            shapeCount: chain1.shapes.length,
            shapeTypes: chain1.shapes.map((s) => s.type),
            controlPointCount:
                chain1.shapes[0]?.type === 'spline'
                    ? (chain1.shapes[0].geometry as Spline).controlPoints
                          ?.length
                    : undefined,
        });

        console.log('chain-18:', {
            id: chain18.id,
            shapeCount: chain18.shapes.length,
            shapeTypes: chain18.shapes.map((s) => s.type),
            controlPointCount:
                chain18.shapes[0]?.type === 'spline'
                    ? (chain18.shapes[0].geometry as Spline).controlPoints
                          ?.length
                    : undefined,
        });

        // Detect parts
        const result = await detectParts(chains, tolerance);

        console.log('Parts detected:', result.parts.length);
        console.log('Warnings:', result.warnings);

        // Find which part contains chain-1 as its shell
        const partWithChain1 = result.parts.find(
            (p) => p.shell.id === chain1.id
        );

        if (!partWithChain1) {
            console.log(
                'Parts found:',
                result.parts.map((p) => ({
                    id: p.id,
                    shellId: p.shell.id,
                    voidCount: p.voids.length,
                    slotCount: p.slots.length,
                }))
            );
            throw new Error('Part with chain-1 as shell not found');
        }

        console.log('Part with chain-1:', {
            id: partWithChain1.id,
            shellId: partWithChain1.shell.id,
            voidCount: partWithChain1.voids.length,
            slotCount: partWithChain1.slots.length,
            slotChainIds: partWithChain1.slots.map((s) => s.chain.id),
        });

        // Check if chain-18 is detected as a slot in this part
        const chain18IsSlot = partWithChain1.slots.some(
            (s) => s.chain.id === chain18.id
        );

        console.log('chain-18 detected as slot?', chain18IsSlot);

        // DEBUG: Test the exact points from chain-18
        if (!chain18IsSlot) {
            const startPoint = getShapeStartPoint(chain18.shapes[0]);
            const endPoint = getShapeEndPoint(chain18.shapes[0]);

            console.log('chain-18 start point:', startPoint);
            console.log('chain-18 end point:', endPoint);

            const startInside = isPointInsideChainExact(startPoint, chain1);
            const endInside = isPointInsideChainExact(endPoint, chain1);

            console.log('Start point inside chain-1?', startInside);
            console.log('End point inside chain-1?', endInside);

            // Also test a mid-point if it's a spline
            if (chain18.shapes[0].type === 'spline') {
                const midPoint = (chain18.shapes[0].geometry as Spline)
                    .controlPoints[1];
                const midInside = isPointInsideChainExact(midPoint, chain1);
                console.log('Mid point inside chain-1?', midInside);
            }
        }

        expect(chain18IsSlot).toBe(true);
    });
});
