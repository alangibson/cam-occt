import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { type Chain } from '$lib/geometry/chain/interfaces';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import { polylineToPoints } from '$lib/geometry/polyline';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import type { Arc, Circle, Line, Polyline, Shape } from '$lib/types/geometry';
import type { BoundingBox } from '$lib/geometry/bounding-box';

describe('Tractor Seat Mount Part Detection', () => {
    it('should detect 1 part with multiple holes for Tractor Seat Mount - Left.dxf', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF with default options
        const drawing = await parseDXF(dxfContent);

        console.log(`Total shapes: ${drawing.shapes.length}`);
        console.log('Shapes by type:', {
            circles: drawing.shapes.filter((s) => s.type === 'circle').length,
            lines: drawing.shapes.filter((s) => s.type === 'line').length,
            arcs: drawing.shapes.filter((s) => s.type === 'arc').length,
            polylines: drawing.shapes.filter((s) => s.type === 'polyline')
                .length,
        });

        // Detect chains with standard tolerance
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.05 });
        console.log(`Total chains detected: ${chains.length}`);

        // Analyze chain closure for debugging
        for (const chain of chains) {
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];

            // Get start and end points using same logic as part detection
            const firstStart = getShapeStartPoint(firstShape);
            const lastEnd = getShapeEndPoint(lastShape);

            let distance = 0;
            let tolerance = 0.01;
            let isClosed = false;
            distance = Math.sqrt(
                Math.pow(firstStart.x - lastEnd.x, 2) +
                    Math.pow(firstStart.y - lastEnd.y, 2)
            );
            tolerance = calculateClosureTolerance(chain);
            isClosed = distance < tolerance;

            console.log(
                `Chain ${chain.id}: ${chain.shapes.length} shapes, distance: ${distance.toFixed(6)}, tolerance: ${tolerance.toFixed(6)}, closed: ${isClosed}`
            );
        }

        // Detect parts
        const partResult = await detectParts(chains);

        console.log(`Parts detected: ${partResult.parts.length}`);
        console.log(`Warnings: ${partResult.warnings.length}`);

        for (const part of partResult.parts) {
            console.log(
                `Part ${part.id}: ${part.holes.length} holes, shell has ${part.shell.chain.shapes.length} shapes`
            );
            console.log(`  Shell bounding box:`, part.shell.boundingBox);
        }

        // Find the largest part (should be the main boundary)
        const largestPart = partResult.parts.reduce((largest, current) =>
            current.shell.chain.shapes.length >
            largest.shell.chain.shapes.length
                ? current
                : largest
        );
        console.log(
            `Largest part: ${largestPart.id} with ${largestPart.shell.chain.shapes.length} shapes`
        );

        // Check which closed chains should be inside the largest part
        const closedChains = chains.filter((chain) => {
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];
            const firstStart = getShapeStartPoint(firstShape);
            const lastEnd = getShapeEndPoint(lastShape);

            const distance: number = Math.sqrt(
                Math.pow(firstStart.x - lastEnd.x, 2) +
                    Math.pow(firstStart.y - lastEnd.y, 2)
            );
            const tolerance = calculateClosureTolerance(chain);
            return distance < tolerance;
        });

        console.log(`Closed chains: ${closedChains.length}`);
        for (const chain of closedChains) {
            const bbox = calculateChainBoundingBox(chain);
            console.log(
                `  Chain ${chain.id}: ${chain.shapes.length} shapes, bbox: [${bbox.min.x.toFixed(1)}, ${bbox.min.y.toFixed(1)}, ${bbox.max.x.toFixed(1)}, ${bbox.max.y.toFixed(1)}]`
            );
        }

        // The expectation: should detect 1 part with multiple holes
        // Currently this will fail, showing us the actual problem
        expect(partResult.parts).toHaveLength(1);
        expect(partResult.parts[0].holes.length).toBeGreaterThan(0);
    });
});

// Helper functions copied from part-detection.ts for testing
function calculateClosureTolerance(chain: Chain): number {
    // Base tolerance for precision errors
    const baseTolerance = 0.01;

    // Calculate chain bounding box to understand scale
    const boundingBox = calculateChainBoundingBox(chain);
    const chainWidth = boundingBox.max.x - boundingBox.min.x;
    const chainHeight = boundingBox.max.y - boundingBox.min.y;
    const chainSize = Math.max(chainWidth, chainHeight);

    // For large chains, allow larger gaps (up to 5% of chain size)
    const sizeTolerance = Math.max(chainSize * 0.05, baseTolerance);

    // For complex chains (many shapes), be much more lenient
    const complexityFactor = Math.min(chain.shapes.length / 5, 5.0); // Up to 5x for complex chains
    const complexityTolerance = baseTolerance * complexityFactor;

    // Use the maximum of all tolerances, but cap at reasonable limit
    const maxTolerance = Math.max(sizeTolerance, complexityTolerance);
    const cappedTolerance = Math.min(maxTolerance, chainSize * 0.1); // Max 10% of chain size

    return cappedTolerance;
}

function calculateChainBoundingBox(chain: Chain): BoundingBox {
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

    for (const shape of chain.shapes) {
        const shapeBounds = getShapeBoundingBox(shape);
        minX = Math.min(minX, shapeBounds.min.x);
        maxX = Math.max(maxX, shapeBounds.max.x);
        minY = Math.min(minY, shapeBounds.min.y);
        maxY = Math.max(maxY, shapeBounds.max.y);
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}

function getShapeBoundingBox(shape: Shape): BoundingBox {
    switch (shape.type) {
        case 'line':
            const line = shape.geometry as Line;
            return {
                min: {
                    x: Math.min(line.start.x, line.end.x),
                    y: Math.min(line.start.y, line.end.y),
                },
                max: {
                    x: Math.max(line.start.x, line.end.x),
                    y: Math.max(line.start.y, line.end.y),
                },
            };

        case 'circle':
            const circle = shape.geometry as Circle;
            return {
                min: {
                    x: circle.center.x - circle.radius,
                    y: circle.center.y - circle.radius,
                },
                max: {
                    x: circle.center.x + circle.radius,
                    y: circle.center.y + circle.radius,
                },
            };

        case 'arc':
            const arc = shape.geometry as Arc;
            // Simplified: use circle bounding box
            return {
                min: {
                    x: arc.center.x - arc.radius,
                    y: arc.center.y - arc.radius,
                },
                max: {
                    x: arc.center.x + arc.radius,
                    y: arc.center.y + arc.radius,
                },
            };

        case 'polyline':
            const polyline = shape.geometry as Polyline;
            let minX = Infinity,
                maxX = -Infinity,
                minY = Infinity,
                maxY = -Infinity;
            for (const point of polylineToPoints(polyline)) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
            return {
                min: { x: minX, y: minY },
                max: { x: maxX, y: maxY },
            };

        default:
            return {
                min: { x: 0, y: 0 },
                max: { x: 0, y: 0 },
            };
    }
}
