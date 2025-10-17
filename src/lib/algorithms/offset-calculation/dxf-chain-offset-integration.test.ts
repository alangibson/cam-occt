import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { scaleShape } from '$lib/geometry/shape/functions';
import { calculateDynamicTolerance } from '$lib/geometry/bounding-box';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { SVGBuilder } from '$lib/test/svg-builder';
import { GeometryType, type Shape } from '$lib/geometry/shape';
import type { Circle } from '$lib/geometry/circle';
import { Unit, getPhysicalScaleFactor } from '$lib/utils/units';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { normalizeChain } from '$lib/geometry/chain/chain-normalization';
import { decomposePolylines } from '$lib/algorithms/decompose-polylines/decompose-polylines';
import { offsetChain } from './chain/offset';
import type { ChainOffsetResult } from './chain/types';

// Shared function for DXF processing and offset visualization
async function processDxfFile(
    filename: string,
    outputDir: string,
    displayUnit: Unit = Unit.MM
) {
    // Load DXF file
    const dxfContent = readFileSync(`tests/dxf/${filename}`, 'utf-8');

    // Parse DXF to shapes
    const drawing = await parseDXF(dxfContent);
    let shapes = drawing.shapes;

    console.log(`Loaded ${shapes.length} shapes from ${filename}`);

    // Calculate physical scale factor for proper visual display
    const physicalScale = getPhysicalScaleFactor(drawing.units, displayUnit);

    // Scale shapes first, then calculate tolerance and detect chains on scaled coordinates
    shapes = shapes.map((shape) =>
        scaleShape(shape, physicalScale, { x: 0, y: 0 })
    );

    // Decompose polylines into individual line and arc segments
    shapes = decomposePolylines(shapes);
    console.log(`After decomposition: ${shapes.length} shapes`);

    // Calculate dynamic tolerance based on scaled drawing size
    const tolerance = calculateDynamicTolerance(shapes, 0.1);

    // Detect chains on scaled coordinates
    const detectedChains = detectShapeChains(shapes, { tolerance });
    console.log(`Detected ${detectedChains.length} chains`);

    // Create SVG for inner offsets only
    const innerSvg = new SVGBuilder();

    // Create SVG for outer offsets only
    const outerSvg = new SVGBuilder();

    // Draw original shapes in black on both SVGs (already scaled)
    shapes.forEach((shape) => {
        innerSvg.addShape(shape, 'black', 1.5, 'Original');
        outerSvg.addShape(shape, 'black', 1.5, 'Original');
    });

    // Process each chain
    let chainIndex = 0;
    for (const chain of detectedChains) {
        chainIndex++;

        // Normalize the chain
        let normalizedChain: Chain;
        try {
            normalizedChain = normalizeChain(chain, {
                traversalTolerance: tolerance,
                maxTraversalAttempts: 5,
            });
        } catch (error) {
            console.warn(`Failed to normalize chain ${chainIndex}: ${error}`);
            continue;
        }
        // let normalizedChain: Chain = chain;

        // Scale the offset distance to match the scaled coordinates
        const offsetDistance = 0.25 * physicalScale;
        const maxExtension = 5 * physicalScale;
        const snapThreshold = 0.5 * physicalScale;

        // console.log('Offsetting normalized chain', JSON.stringify(normalizedChain, null, 4));

        // Calculate offsets with filled gaps
        const offsetResult: ChainOffsetResult = offsetChain(
            normalizedChain,
            offsetDistance,
            {
                tolerance,
                maxExtension,
                snapThreshold,
            }
        );

        console.log(
            `Chain ${chainIndex}: offset result - innerChain: ${offsetResult.innerChain ? 'exists with ' + offsetResult.innerChain.shapes.length + ' shapes' : 'null'}, outerChain: ${offsetResult.outerChain ? 'exists with ' + offsetResult.outerChain.shapes.length + ' shapes' : 'null'}`
        );

        // Draw inner offsets to inner SVG
        if (offsetResult.innerChain) {
            console.log(
                `Adding ${offsetResult.innerChain.shapes.length} inner offset shapes to SVG`
            );
            offsetResult.innerChain.shapes.forEach((shape) => {
                innerSvg.addShape(shape, 'blue', 1, 'Inner Offset');
            });

            // Mark intersection points in yellow from offset chain results (already scaled)
            if (offsetResult.innerChain.intersectionPoints) {
                offsetResult.innerChain.intersectionPoints.forEach(
                    (intersection, idx) => {
                        const intersectionCircle: Circle = {
                            center: intersection.point,
                            radius: 5,
                        };
                        const intersectionShape: Shape = {
                            id: `inner-intersection-${chainIndex}-${idx}`,
                            type: GeometryType.CIRCLE,
                            geometry: intersectionCircle,
                        };
                        innerSvg.addShape(intersectionShape, 'yellow', 1);
                    }
                );
            }
        }

        // Draw outer offsets to outer SVG
        if (offsetResult.outerChain) {
            offsetResult.outerChain.shapes.forEach((shape) => {
                outerSvg.addShape(shape, 'red', 1, 'Outer Offset');
            });

            // Mark intersection points in yellow from offset chain results (already scaled)
            if (offsetResult.outerChain.intersectionPoints) {
                offsetResult.outerChain.intersectionPoints.forEach(
                    (intersection, idx) => {
                        const intersectionCircle: Circle = {
                            center: intersection.point,
                            radius: 5,
                        };
                        const intersectionShape: Shape = {
                            id: `outer-intersection-${chainIndex}-${idx}`,
                            type: GeometryType.CIRCLE,
                            geometry: intersectionCircle,
                        };
                        outerSvg.addShape(intersectionShape, 'yellow', 1);
                    }
                );
            }
        }
    }

    // Add legends
    innerSvg.addLegend([
        { color: 'black', label: 'Original Shapes' },
        { color: 'blue', label: 'Inner Offset' },
        { color: 'yellow', label: 'Self-Intersections' },
    ]);

    outerSvg.addLegend([
        { color: 'black', label: 'Original Shapes' },
        { color: 'red', label: 'Outer Offset' },
        { color: 'yellow', label: 'Self-Intersections' },
    ]);

    // Save both SVGs
    const baseName = filename.replace('.dxf', '');
    const innerSvgContent = innerSvg.toString();
    const outerSvgContent = outerSvg.toString();
    writeFileSync(
        join(outputDir, `${baseName}-inner-offsets.svg`),
        innerSvgContent
    );
    writeFileSync(
        join(outputDir, `${baseName}-outer-offsets.svg`),
        outerSvgContent
    );

    return { shapes, detectedChains };
}

describe('DXF Chain Offset Integration Test', () => {
    const outputDir = 'tests/output/visual/chain/dxf';

    beforeAll(() => {
        mkdirSync(outputDir, { recursive: true });
    });

    it('should load ADLER.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'ADLER.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load probleme.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'probleme.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load 2013-11-08_test.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            '2013-11-08_test.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load Tractor Seat Mount - Left.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'Tractor Seat Mount - Left.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for this complex test

    it('should load polylines_with_bulge.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'polylines_with_bulge.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load Polylinie.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'Polylinie.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load polyline-pill.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'polyline-pill.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load chain-pill.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'chain-pill.dxf',
            outputDir
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    });

    it('should load YOUCANMOVEMOUNTAINS.dxf, convert to chains, apply offsets, and render to SVG', async () => {
        const { shapes, detectedChains } = await processDxfFile(
            'YOUCANMOVEMOUNTAINS.dxf',
            outputDir,
            Unit.INCH
        );

        // Basic validation
        expect(shapes.length).toBeGreaterThan(0);
        expect(detectedChains.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for this complex test
});
