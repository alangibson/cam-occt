import { describe, it, expect } from 'vitest';
import { offsetPaths } from './clipper-offset';
import { reconstructChain } from './reconstruct';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';

describe('offsetPaths', () => {
    it('should return closed polygons for closed input paths', async () => {
        // Create a simple square: (0,0) -> (100,0) -> (100,100) -> (0,100)
        const square: Polyline = {
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
            ],
        };

        const offsetDistance = 10;
        const isClosed = true;

        const result = await offsetPaths([square], offsetDistance, isClosed);

        // Check that we got results
        expect(result.inner).toBeDefined();
        expect(result.outer).toBeDefined();
        expect(result.inner.length).toBeGreaterThan(0);
        expect(result.outer.length).toBeGreaterThan(0);

        // For a simple square, we should get exactly 1 polygon for inner and 1 for outer
        expect(result.inner.length).toBe(1);
        expect(result.outer.length).toBe(1);

        const innerPolyline = result.inner[0];
        const outerPolyline = result.outer[0];

        // Check if polygons are closed (first point equals last point)
        const innerFirstPoint = innerPolyline.points[0];
        const innerLastPoint =
            innerPolyline.points[innerPolyline.points.length - 1];

        const outerFirstPoint = outerPolyline.points[0];
        const outerLastPoint =
            outerPolyline.points[outerPolyline.points.length - 1];

        console.log('Inner polygon:');
        console.log(
            `  First point: (${innerFirstPoint.x}, ${innerFirstPoint.y})`
        );
        console.log(`  Last point: (${innerLastPoint.x}, ${innerLastPoint.y})`);
        console.log(`  Total points: ${innerPolyline.points.length}`);
        console.log(
            `  Points equal: ${innerFirstPoint.x === innerLastPoint.x && innerFirstPoint.y === innerLastPoint.y}`
        );

        console.log('Outer polygon:');
        console.log(
            `  First point: (${outerFirstPoint.x}, ${outerFirstPoint.y})`
        );
        console.log(`  Last point: (${outerLastPoint.x}, ${outerLastPoint.y})`);
        console.log(`  Total points: ${outerPolyline.points.length}`);
        console.log(
            `  Points equal: ${outerFirstPoint.x === outerLastPoint.x && outerFirstPoint.y === outerLastPoint.y}`
        );

        // Clipper2 typically returns closed polygons WITHOUT duplicating the first point
        // So first and last points should be DIFFERENT for a closed polygon
        // The polygon is implicitly closed
        const tolerance = 0.001;

        const innerFirstLastDistance = Math.sqrt(
            Math.pow(innerFirstPoint.x - innerLastPoint.x, 2) +
                Math.pow(innerFirstPoint.y - innerLastPoint.y, 2)
        );

        const outerFirstLastDistance = Math.sqrt(
            Math.pow(outerFirstPoint.x - outerLastPoint.x, 2) +
                Math.pow(outerFirstPoint.y - outerLastPoint.y, 2)
        );

        // This test will tell us whether Clipper2 duplicates the first point or not
        // If distance > tolerance, then first != last (implicit closure)
        // If distance <= tolerance, then first == last (explicit closure)
        console.log(`Inner first-last distance: ${innerFirstLastDistance}`);
        console.log(`Outer first-last distance: ${outerFirstLastDistance}`);

        // Verify that Clipper2 does NOT duplicate the first point
        // (i.e., returns implicit closed polygons)
        expect(innerFirstLastDistance).toBeGreaterThan(tolerance);
        expect(outerFirstLastDistance).toBeGreaterThan(tolerance);
    });

    it('should handle multiple point arrays correctly', async () => {
        // Create two separate squares
        const square1: Polyline = {
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
            ],
        };

        const square2: Polyline = {
            points: [
                { x: 100, y: 100 },
                { x: 110, y: 100 },
                { x: 110, y: 110 },
                { x: 100, y: 110 },
            ],
        };

        const offsetDistance = 2;
        const isClosed = true;

        const result = await offsetPaths(
            [square1, square2],
            offsetDistance,
            isClosed
        );

        console.log(`Number of inner polygons: ${result.inner.length}`);
        console.log(`Number of outer polygons: ${result.outer.length}`);

        // We should get results for each input polygon
        // This tells us if Clipper2 maintains separate polygons or merges them
        expect(result.inner.length).toBeGreaterThan(0);
        expect(result.outer.length).toBeGreaterThan(0);
    });

    it('should reconstruct closed chains correctly', async () => {
        // Create a simple square
        const square: Polyline = {
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
            ],
        };

        const offsetDistance = 10;
        const isClosed = true;

        const result = await offsetPaths([square], offsetDistance, isClosed);

        // Reconstruct the inner chain
        const innerShapes = reconstructChain(result.inner);

        console.log(`Number of reconstructed shapes: ${innerShapes.length}`);
        console.log(
            `Number of point arrays from Clipper2: ${result.inner.length}`
        );

        // All shapes should be lines
        expect(innerShapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );

        // For a square, we expect 4 lines + 1 closing line = 5 shapes total
        // (or 4 if Clipper2 already closed it)
        console.log('Reconstructed shape endpoints:');
        for (let i = 0; i < innerShapes.length; i++) {
            const line = innerShapes[i].geometry as Line;
            console.log(
                `  Shape ${i}: (${line.start.x}, ${line.start.y}) -> (${line.end.x}, ${line.end.y})`
            );
        }

        // Check if the chain is closed
        const firstShape = innerShapes[0];
        const lastShape = innerShapes[innerShapes.length - 1];
        const firstStart = (firstShape.geometry as Line).start;
        const lastEnd = (lastShape.geometry as Line).end;

        const closureDistance = Math.sqrt(
            Math.pow(firstStart.x - lastEnd.x, 2) +
                Math.pow(firstStart.y - lastEnd.y, 2)
        );

        console.log(`First shape start: (${firstStart.x}, ${firstStart.y})`);
        console.log(`Last shape end: (${lastEnd.x}, ${lastEnd.y})`);
        console.log(`Closure distance: ${closureDistance}`);

        // The chain MUST be closed (last end = first start)
        expect(closureDistance).toBeLessThan(0.001);
    });

    it('should reconstruct multiple disconnected polygons with proper closing segments', async () => {
        // Create two separate squares (disconnected)
        const square1: Polyline = {
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
            ],
        };

        const square2: Polyline = {
            points: [
                { x: 100, y: 100 },
                { x: 110, y: 100 },
                { x: 110, y: 110 },
                { x: 100, y: 110 },
            ],
        };

        const offsetDistance = 2;
        const isClosed = true;

        const result = await offsetPaths(
            [square1, square2],
            offsetDistance,
            isClosed
        );

        console.log(`Clipper2 returned ${result.inner.length} inner polygons`);

        // Reconstruct should handle multiple polygons by closing each one individually
        const shapes = reconstructChain(result.inner);

        // Each square has 4 vertices -> 3 edges between consecutive points + 1 closing edge = 4 segments per square
        // Two squares = 8 segments total (may be more if Clipper2 adds intermediate points)
        expect(shapes.length).toBeGreaterThanOrEqual(8);

        // All shapes should be lines
        expect(shapes.every((s) => s.type === 'line')).toBe(true);

        // Verify the shapes form closed loops (can check by counting)
        expect(shapes.length % 2).toBe(0); // Should be even for symmetric offsets
    });
});
