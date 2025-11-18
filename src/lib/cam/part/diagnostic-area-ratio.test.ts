import { describe, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isChainClosed, tessellateChain } from '$lib/geometry/chain/functions';
import { normalizeChain } from '$lib/geometry/chain/chain-normalization';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import {
    toClipper2Paths,
    calculateClipper2PathsArea,
} from '$lib/cam/offset/convert';

describe('Diagnostic - Area Ratio Analysis', () => {
    it('analyze area ratios for failing circle containment in Tractor Light Mount', async () => {
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

        const chain1 = closedChains.find((c) => c.id === 'chain-1');
        const chain2 = closedChains.find((c) => c.id === 'chain-2');
        const chain3 = closedChains.find((c) => c.id === 'chain-3');

        console.log(
            '\n========== Area Ratio Analysis - Tractor Light Mount =========='
        );

        const clipper = await getClipper2();

        if (chain1 && chain3) {
            const innerPoints = tessellateChain(
                chain1,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
            const outerPoints = tessellateChain(
                chain3,
                DEFAULT_PART_DETECTION_PARAMETERS
            );

            console.log(
                `\nchain-1 (${chain1.shapes.map((s) => s.type).join(', ')}):`
            );
            console.log(`  Tessellated to ${innerPoints.length} points`);

            const innerPaths = toClipper2Paths([innerPoints], clipper);
            const outerPaths = toClipper2Paths([outerPoints], clipper);

            const innerArea = calculateClipper2PathsArea(innerPaths);
            const intersection = clipper.Intersect64(
                innerPaths,
                outerPaths,
                clipper.FillRule.NonZero
            );
            const intersectionArea = calculateClipper2PathsArea(intersection);

            console.log(`  Inner area: ${innerArea}`);
            console.log(`  Intersection area: ${intersectionArea}`);
            console.log(
                `  Area ratio: ${(intersectionArea / innerArea).toFixed(4)} (needs > 0.9 for containment)`
            );

            innerPaths.delete();
            outerPaths.delete();
            intersection.delete();
        }

        if (chain2 && chain3) {
            const innerPoints = tessellateChain(
                chain2,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
            const outerPoints = tessellateChain(
                chain3,
                DEFAULT_PART_DETECTION_PARAMETERS
            );

            console.log(
                `\nchain-2 (${chain2.shapes.map((s) => s.type).join(', ')}):`
            );
            console.log(`  Tessellated to ${innerPoints.length} points`);

            const innerPaths = toClipper2Paths([innerPoints], clipper);
            const outerPaths = toClipper2Paths([outerPoints], clipper);

            const innerArea = calculateClipper2PathsArea(innerPaths);
            const intersection = clipper.Intersect64(
                innerPaths,
                outerPaths,
                clipper.FillRule.NonZero
            );
            const intersectionArea = calculateClipper2PathsArea(intersection);

            console.log(`  Inner area: ${innerArea}`);
            console.log(`  Intersection area: ${intersectionArea}`);
            console.log(
                `  Area ratio: ${(intersectionArea / innerArea).toFixed(4)} (needs > 0.9 for containment)`
            );

            innerPaths.delete();
            outerPaths.delete();
            intersection.delete();
        }
    });

    it('analyze area ratios for failing circle containment in Tractor Seat Mount', async () => {
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

        const chain1 = closedChains.find((c) => c.id === 'chain-1');
        const chain5 = closedChains.find((c) => c.id === 'chain-5');

        console.log(
            '\n========== Area Ratio Analysis - Tractor Seat Mount =========='
        );

        const clipper = await getClipper2();

        if (chain1 && chain5) {
            const innerPoints = tessellateChain(
                chain1,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
            const outerPoints = tessellateChain(
                chain5,
                DEFAULT_PART_DETECTION_PARAMETERS
            );

            console.log(
                `\nchain-1 (${chain1.shapes.map((s) => s.type).join(', ')}):`
            );
            console.log(`  Tessellated to ${innerPoints.length} points`);

            const innerPaths = toClipper2Paths([innerPoints], clipper);
            const outerPaths = toClipper2Paths([outerPoints], clipper);

            const innerArea = calculateClipper2PathsArea(innerPaths);
            const intersection = clipper.Intersect64(
                innerPaths,
                outerPaths,
                clipper.FillRule.NonZero
            );
            const intersectionArea = calculateClipper2PathsArea(intersection);

            console.log(`  Inner area: ${innerArea}`);
            console.log(`  Intersection area: ${intersectionArea}`);
            console.log(
                `  Area ratio: ${(intersectionArea / innerArea).toFixed(4)} (needs > 0.9 for containment)`
            );

            innerPaths.delete();
            outerPaths.delete();
            intersection.delete();
        }
    });
});
