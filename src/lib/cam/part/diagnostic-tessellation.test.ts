import { describe, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isChainClosed, tessellateChain } from '$lib/cam/chain/functions';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import {
    toClipper2Paths,
    calculateClipper2PathsArea,
} from '$lib/cam/offset/convert';
import { Shape } from '$lib/cam/shape/classes';

describe('Diagnostic - Tessellation Analysis', () => {
    it('analyze tessellation of circle chains in Tractor Light Mount', async () => {
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

        console.log(
            '\n========== Tessellation Analysis - Circle Chain =========='
        );

        if (chain1) {
            console.log(`\nchain-1: ${chain1.shapes.length} shapes`);
            chain1.shapes.forEach((shape, idx) => {
                console.log(`  Shape ${idx}: ${shape.type}`);
                if (shape.type === 'circle') {
                    const circle = shape.geometry as any;
                    console.log(
                        `    center: (${circle.center.x.toFixed(2)}, ${circle.center.y.toFixed(2)})`
                    );
                    console.log(`    radius: ${circle.radius.toFixed(2)}`);
                    console.log(
                        `    startAngle: ${circle.startAngle?.toFixed(4)}`
                    );
                    console.log(`    endAngle: ${circle.endAngle?.toFixed(4)}`);
                }
            });

            const tessellated = tessellateChain(
                chain1,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
            console.log(`\nTessellated to ${tessellated.length} points`);
            console.log('First 10 points:');
            tessellated.slice(0, 10).forEach((p, idx) => {
                console.log(`  ${idx}: (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`);
            });
            console.log('Last 10 points:');
            tessellated.slice(-10).forEach((p, idx) => {
                console.log(
                    `  ${tessellated.length - 10 + idx}: (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`
                );
            });

            // Check if first and last points match (closed polygon)
            const first = tessellated[0];
            const last = tessellated[tessellated.length - 1];
            const dist = Math.sqrt(
                Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
            );
            console.log(`\nFirst/Last point distance: ${dist.toFixed(6)}`);
            console.log(`Polygon is closed: ${dist < 0.01}`);

            // Check if we're getting a full circle or partial
            const clipper = await getClipper2();

            const paths = toClipper2Paths([tessellated], clipper);
            const area = calculateClipper2PathsArea(paths);

            // Calculate expected area from shape data
            if (chain1.shapes[0].type === 'circle') {
                const circle = chain1.shapes[0].geometry as any;
                const radius = circle.radius;
                const expectedFullCircleArea = Math.PI * radius * radius;
                console.log(
                    `\nExpected full circle area: ${expectedFullCircleArea.toFixed(2)}`
                );
                console.log(`Actual tessellated area: ${area.toFixed(2)}`);
                console.log(
                    `Area ratio: ${(area / expectedFullCircleArea).toFixed(4)}`
                );
            }

            paths.delete();
        }
    });
});
