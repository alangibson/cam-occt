import { describe, expect, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Chain } from '$lib/geometry/chain/interfaces';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { isChainClosed } from '$lib/geometry/chain/functions';

/**
 * Calculate the gap distance between first and last shape in a chain
 */
function calculateChainGap(chain: Chain): number {
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

describe('Part Detection - Tiger DXF Imperial Unit Issue', () => {
    it('demonstrates the actual issue: 15 closed splines form nested structure', async () => {
        // This test reveals the ACTUAL issue with the tiger DXF
        //
        // REALITY: The file contains 15 individually-closed splines (start = end for each)
        // These 15 closed loops are NOT connected to each other - there are 9-40mm gaps between them
        //
        // The tiger image is composed of:
        // - Multiple closed contours that together form the tiger shape
        // - Each contour is a separate closed spline
        // - The part detection algorithm sees this as nested containment (parts within holes within parts)
        //
        // With default tolerance (0.05mm):
        // - 15 separate closed chains are detected (CORRECT - each spline is closed)
        // - Containment analysis interprets some as parts, some as holes
        // - Results in 8 parts due to the nesting structure
        //
        // This is NOT a bug - the file genuinely has 15 separate closed loops.
        // To treat this as "1 part", the user would need to manually merge/union the geometry.

        const filePath = join(
            process.cwd(),
            'tests/dxf/non-free/qvswL-hunting-tiger-decor-art-animal.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse the DXF file - file has $INSUNITS=5 (centimeters)
        const drawing = await parseDXF(dxfContent);

        console.log(`Original drawing units: ${drawing.units}`);
        console.log(`Original shape count: ${drawing.shapes.length}`);

        // Use default tolerance (what the UI uses by default)
        const tolerance = 0.05; // Default chain detection tolerance
        console.log(`Using default tolerance: ${tolerance}mm`);

        // Detect chains with default tolerance
        const chains = detectShapeChains(drawing.shapes, {
            tolerance: tolerance,
        });

        console.log(`\nChains detected: ${chains.length}`);
        chains.forEach((chain, idx) => {
            const gap = calculateChainGap(chain);
            const closed = isChainClosed(chain, tolerance);
            console.log(
                `  Chain ${idx + 1}: ${chain.shapes.length} shapes, gap=${gap.toFixed(6)}, closed=${closed}`
            );
        });

        const partResult = await detectParts(chains, tolerance);
        console.log(`Parts detected: ${partResult.parts.length}`);
        console.log('\nPart structure:');
        partResult.parts.forEach((part, idx) => {
            console.log(`  Part ${idx + 1}: ${part.voids.length} holes`);
        });

        // EXPECTED BEHAVIOR: 15 closed chains form a nested structure
        // The algorithm correctly interprets this as multiple parts
        expect(chains.length).toBe(15); // Each spline is its own closed chain
        expect(partResult.parts.length).toBe(8); // Nesting creates 8 parts
    });

    it('can force merge into 1 part by using very high tolerance', async () => {
        // This test shows how to work around the issue by treating it as a file quality problem
        // By increasing tolerance to bridge the 9-40mm gaps, we force the 15 closed splines
        // to be treated as a single connected chain.
        //
        // NOTE: This is a workaround, not the correct interpretation of the geometry.
        // The file genuinely has 15 separate closed loops.

        const filePath = join(
            process.cwd(),
            'tests/dxf/non-free/qvswL-hunting-tiger-decor-art-animal.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse the DXF file - file has $INSUNITS=5 (centimeters)
        const drawing = await parseDXF(dxfContent);

        console.log(`Original drawing units: ${drawing.units}`);
        console.log(`Original shape count: ${drawing.shapes.length}`);

        // WORKAROUND: Use very high tolerance to force-merge the 15 separate closed splines
        // Gaps range from 9-40mm, so 50mm tolerance will connect all splines
        const tolerance = 50.0;
        console.log(`Using forced-merge tolerance: ${tolerance}mm`);

        // Detect chains with very high tolerance
        const chains = detectShapeChains(drawing.shapes, {
            tolerance: tolerance,
        });

        console.log(`\nChains detected: ${chains.length}`);
        chains.forEach((chain, idx) => {
            const gap = calculateChainGap(chain);
            const closed = isChainClosed(chain, tolerance);
            console.log(
                `  Chain ${idx + 1}: ${chain.shapes.length} shapes, gap=${gap.toFixed(6)}, closed=${closed}`
            );
        });

        const partResult = await detectParts(chains, tolerance);
        console.log(`Parts detected: ${partResult.parts.length}`);

        // With very high tolerance, all splines are forced to merge into 1 chain → 1 part
        // But note: the chain is technically not closed (gap=35mm)
        expect(partResult.parts).toHaveLength(1);
        expect(chains).toHaveLength(1); // All shapes force-connected into one chain
    });

    it('diagnostic test: shows actual gap measurements in tiger DXF geometry', async () => {
        // Load the test file
        const filePath = join(
            process.cwd(),
            'tests/dxf/non-free/qvswL-hunting-tiger-decor-art-animal.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');

        // Parse with original units (cm → mm)
        const drawing = await parseDXF(dxfContent);

        console.log(`\n=== Analyzing Tiger DXF Gaps ===`);
        console.log(`Drawing units: ${drawing.units}`);
        console.log(
            `Drawing bounds: (${drawing.bounds.min.x}, ${drawing.bounds.min.y}) to (${drawing.bounds.max.x}, ${drawing.bounds.max.y})`
        );
        console.log(`Shape count: ${drawing.shapes.length}`);

        // Check shape types
        console.log('\nShape types:');
        const shapeTypes = new Map<string, number>();
        drawing.shapes.forEach((shape) => {
            const count = shapeTypes.get(shape.type) || 0;
            shapeTypes.set(shape.type, count + 1);
        });
        shapeTypes.forEach((count, type) => {
            console.log(`  ${type}: ${count}`);
        });

        // Check if individual splines are closed
        console.log('\nChecking if individual splines are closed:');
        for (let i = 0; i < drawing.shapes.length; i++) {
            const shape = drawing.shapes[i];
            const start = getShapeStartPoint(shape);
            const end = getShapeEndPoint(shape);
            const selfGap = Math.sqrt(
                Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2)
            );
            console.log(
                `  Spline ${i}: start-end gap = ${selfGap.toFixed(6)}mm ${selfGap < 0.05 ? '(CLOSED)' : '(OPEN)'}`
            );
        }

        // Detect chains with very tight tolerance to see actual structure
        const tightTolerance = 0.001;
        const chainsVeryTight = detectShapeChains(drawing.shapes, {
            tolerance: tightTolerance,
        });

        console.log(
            `\nWith very tight tolerance (${tightTolerance}): ${chainsVeryTight.length} chains`
        );

        // Measure gaps between spline endpoints
        console.log('\nAnalyzing spline endpoint connectivity:');
        for (let i = 0; i < drawing.shapes.length; i++) {
            const shape1 = drawing.shapes[i];
            const end1 = getShapeEndPoint(shape1);

            // Find closest start point in other shapes
            let minDist = Infinity;
            let closestIdx = -1;

            for (let j = 0; j < drawing.shapes.length; j++) {
                if (i === j) continue;
                const shape2 = drawing.shapes[j];
                const start2 = getShapeStartPoint(shape2);

                const dist = Math.sqrt(
                    Math.pow(end1.x - start2.x, 2) +
                        Math.pow(end1.y - start2.y, 2)
                );

                if (dist < minDist) {
                    minDist = dist;
                    closestIdx = j;
                }
            }

            if (closestIdx >= 0) {
                console.log(
                    `  Spline ${i} end → Spline ${closestIdx} start: ${minDist.toFixed(6)}`
                );
            }
        }

        // Now with progressively larger tolerances
        console.log('\nChain count by tolerance:');
        const tolerances = [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0];
        for (const tol of tolerances) {
            const chains = detectShapeChains(drawing.shapes, {
                tolerance: tol,
            });
            console.log(`  ${tol}: ${chains.length} chains`);
        }

        // This diagnostic test helps us understand what tolerance values are needed
        // We expect to see fewer chains as tolerance increases, eventually reaching 1
        expect(chainsVeryTight.length).toBeGreaterThan(0);
    });
});
