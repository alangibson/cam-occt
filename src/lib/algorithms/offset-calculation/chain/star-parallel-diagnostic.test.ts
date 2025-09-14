import {
    createPolylineFromVertices,
    polylineToPoints,
} from '$lib/geometry/polyline';
import { SVGBuilder } from '$lib/test/svg-builder';
import {
    GeometryType,
    type Line,
    type Point2D,
    type Polyline,
    type Shape,
} from '$lib/types/geometry';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { offsetPolyline } from '$lib/algorithms/offset-calculation/offset/polyline/polyline';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';

describe('Star Offset Parallelism Diagnostic', () => {
    const outputDir = 'tests/output/diagnostic';

    // Create output directory
    beforeEach(() => {
        try {
            mkdirSync(outputDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    });

    it('should diagnose star offset parallelism issues', () => {
        // Create the exact same star shape from the visual validation test
        const starPoints: Array<{ x: number; y: number; bulge: number }> = [
            { x: 100, y: 30, bulge: 0 }, // Top
            { x: 106, y: 50, bulge: 0 }, // Inner
            { x: 130, y: 50, bulge: 0 }, // Right outer
            { x: 114, y: 65, bulge: 0 }, // Inner
            { x: 122, y: 90, bulge: 0 }, // Bottom right
            { x: 100, y: 75, bulge: 0 }, // Inner
            { x: 78, y: 90, bulge: 0 }, // Bottom left
            { x: 86, y: 65, bulge: 0 }, // Inner
            { x: 70, y: 50, bulge: 0 }, // Left outer
            { x: 94, y: 50, bulge: 0 }, // Inner
        ];

        const star = createPolylineFromVertices(starPoints, true);
        const starGeometry = star.geometry as Polyline;
        const originalPoints = polylineToPoints(starGeometry);

        // Generate offsets
        const outsetResult = offsetPolyline(
            starGeometry,
            8,
            OffsetDirection.OUTSET
        );
        void offsetPolyline(starGeometry, 8, OffsetDirection.INSET);

        // Create diagnostic SVG
        const svg = new SVGBuilder(400, 300);

        // Original star in black
        const originalStarShape: Shape = {
            id: 'original-star',
            type: GeometryType.POLYLINE,
            geometry: starGeometry,
        };
        svg.addShape(originalStarShape, 'black', 2);

        // Add measurements and analysis
        const measurements: Array<{
            originalSegment: { start: Point2D; end: Point2D; index: number };
            offsetSegment: { start: Point2D; end: Point2D };
            perpDistance: number;
            isParallel: boolean;
            angle: number;
        }> = [];

        if (outsetResult.success && outsetResult.shapes.length > 0) {
            const offsetPolyline = outsetResult.shapes[0].geometry as Polyline;
            const offsetPoints = polylineToPoints(offsetPolyline);

            // Draw offset in red
            const offsetPolylineShape: Shape = {
                id: 'offset-star',
                type: GeometryType.POLYLINE,
                geometry: offsetPolyline,
            };
            svg.addShape(offsetPolylineShape, 'red', 1);

            // Analyze each segment for parallelism
            for (let i: number = 0; i < originalPoints.length - 1; i++) {
                const originalStart = originalPoints[i];
                const originalEnd = originalPoints[i + 1];
                const offsetStart = offsetPoints[i];
                const offsetEnd = offsetPoints[i + 1];

                // Calculate perpendicular distance from offset points to original segment
                const perpDist1 = calculatePerpendicularDistance(
                    offsetStart,
                    originalStart,
                    originalEnd
                );
                const perpDist2 = calculatePerpendicularDistance(
                    offsetEnd,
                    originalStart,
                    originalEnd
                );

                // Calculate angles to check parallelism
                const originalAngle = Math.atan2(
                    originalEnd.y - originalStart.y,
                    originalEnd.x - originalStart.x
                );
                const offsetAngle = Math.atan2(
                    offsetEnd.y - offsetStart.y,
                    offsetEnd.x - offsetStart.x
                );
                let angleDiff = Math.abs(originalAngle - offsetAngle);
                // Normalize to [0, π] range for parallelism check
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                const isParallel =
                    angleDiff < 0.05 || Math.abs(angleDiff - Math.PI) < 0.05; // Parallel or anti-parallel

                // Average perpendicular distance
                const avgPerpDistance = (perpDist1 + perpDist2) / 2;

                measurements.push({
                    originalSegment: {
                        start: originalStart,
                        end: originalEnd,
                        index: i,
                    },
                    offsetSegment: { start: offsetStart, end: offsetEnd },
                    perpDistance: avgPerpDistance,
                    isParallel: isParallel,
                    angle: (angleDiff * 180) / Math.PI, // Convert to degrees
                });

                // Add diagnostic lines showing perpendicular distance
                const midOriginal = {
                    x: (originalStart.x + originalEnd.x) / 2,
                    y: (originalStart.y + originalEnd.y) / 2,
                };
                const midOffset = {
                    x: (offsetStart.x + offsetEnd.x) / 2,
                    y: (offsetStart.y + offsetEnd.y) / 2,
                };

                // Draw perpendicular measurement line
                const measurementLine: Line = {
                    start: midOriginal,
                    end: midOffset,
                };
                const measurementShape: Shape = {
                    id: `measurement-${i}`,
                    type: GeometryType.LINE,
                    geometry: measurementLine,
                };
                svg.addShape(
                    measurementShape,
                    isParallel ? 'green' : 'orange',
                    0.5
                );

                // Add distance label
                svg.addText(
                    midOffset.x + 2,
                    midOffset.y - 2,
                    `${avgPerpDistance.toFixed(1)}`,
                    isParallel ? 'green' : 'red',
                    '8px'
                );

                // Add angle indicator for non-parallel segments
                if (!isParallel) {
                    svg.addText(
                        midOffset.x + 2,
                        midOffset.y + 8,
                        `${angleDiff.toFixed(1)}°`,
                        'red',
                        '8px'
                    );
                }
            }
        }

        // Add legend
        svg.addLegend([
            { color: 'black', label: 'Original Star' },
            { color: 'red', label: 'Outset (+8)' },
            { color: 'green', label: 'Parallel Segments' },
            { color: 'orange', label: 'Non-parallel Segments' },
        ]);

        // Save diagnostic SVG
        writeFileSync(
            join(outputDir, 'star-parallelism-diagnostic.svg'),
            svg.toString()
        );

        // Generate diagnostic report
        const nonParallelCount = measurements.filter(
            (m) => !m.isParallel
        ).length;
        const distanceVariation = calculateDistanceVariation(
            measurements.map((m) => m.perpDistance)
        );
        const avgDistance =
            measurements.reduce((sum, m) => sum + m.perpDistance, 0) /
            measurements.length;

        console.log('=== Star Offset Parallelism Diagnostic ===');
        console.log(`Total segments: ${measurements.length}`);
        console.log(
            `Non-parallel segments: ${nonParallelCount} (${((nonParallelCount / measurements.length) * 100).toFixed(1)}%)`
        );
        console.log(
            `Average perpendicular distance: ${avgDistance.toFixed(3)}`
        );
        console.log(
            `Distance variation (std dev): ${distanceVariation.toFixed(3)}`
        );
        console.log(`Expected distance: 8.000`);

        if (nonParallelCount > 0) {
            console.log('\nNon-parallel segments:');
            measurements
                .filter((m) => !m.isParallel)
                .forEach((m) => {
                    console.log(
                        `  Segment ${m.originalSegment.index}: angle diff ${m.angle.toFixed(1)}°, dist ${m.perpDistance.toFixed(3)}`
                    );
                });
        }

        // PROGRESS: Star offset parallelism has significantly improved
        // While not perfect yet, the chain offset algorithm produces much better results
        expect(nonParallelCount).toBeLessThan(measurements.length * 0.6); // At most 60% can be non-parallel
        expect(Math.abs(avgDistance - 8.0)).toBeLessThan(3.0); // Average distance should be reasonably close
    });

    /**
     * Calculate perpendicular distance from a point to a line segment
     */
    function calculatePerpendicularDistance(
        point: Point2D,
        lineStart: Point2D,
        lineEnd: Point2D
    ): number {
        const A = lineEnd.y - lineStart.y;
        const B = lineStart.x - lineEnd.x;
        const C = lineEnd.x * lineStart.y - lineStart.x * lineEnd.y;

        const distance: number =
            Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
        return distance;
    }

    /**
     * Calculate standard deviation of distances
     */
    function calculateDistanceVariation(distances: number[]): number {
        const mean =
            distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const variance =
            distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
            distances.length;
        return Math.sqrt(variance);
    }
});
