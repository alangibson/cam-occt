import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { offsetSpline } from './spline';
import { OffsetDirection } from '../types';
import type { Polyline, Point2D } from '../../../../types/geometry';
import { polylineToPoints } from '$lib/geometry/polyline';
import type { Spline } from '$lib/geometry/spline';

describe('Combination Operations Diagnostic', () => {
    const outputDir = 'test-output/combination-diagnostic';

    it(
        'should handle spline operations + file I/O without hanging',
        { timeout: 15000 },
        () => {
            // Create directory
            try {
                mkdirSync(outputDir, { recursive: true });
            } catch {
                // Directory might already exist
            }

            // Test the exact splines from visual validation
            const testSplines: Spline[] = [
                {
                    controlPoints: [
                        { x: 50, y: 250 },
                        { x: 150, y: 300 },
                        { x: 200, y: 200 },
                        { x: 250, y: 100 },
                        { x: 300, y: 50 },
                        { x: 400, y: 100 },
                    ],
                    degree: 3,
                    knots: [0, 0, 0, 0, 0.33, 0.66, 1, 1, 1, 1],
                    weights: [1, 1, 1, 1, 1, 1],
                    fitPoints: [],
                    closed: false,
                },
                {
                    controlPoints: [
                        { x: 100, y: 50 },
                        { x: 300, y: 50 },
                        { x: 350, y: 150 },
                        { x: 300, y: 250 },
                        { x: 100, y: 250 },
                        { x: 50, y: 150 },
                    ],
                    degree: 2,
                    knots: [0, 0, 0, 0.25, 0.5, 0.75, 1, 1, 1],
                    weights: [1, 1, 1, 1, 1, 1],
                    fitPoints: [],
                    closed: true,
                },
            ];

            let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="450" height="400" viewBox="0 0 450 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white" stroke="lightgray" stroke-width="0.5"/>`;

            testSplines.forEach((spline, index) => {
                const yOffset = index * 180;

                const originalSpline: Spline = {
                    ...spline,
                    controlPoints: spline.controlPoints.map((p: Point2D) => ({
                        x: p.x,
                        y: p.y + yOffset,
                    })),
                };

                // Test the exact operations that hang
                const originalResult = offsetSpline(
                    originalSpline,
                    0.1,
                    OffsetDirection.OUTSET,
                    1.0,
                    3
                );

                const _outsetResult = offsetSpline(
                    originalSpline,
                    25,
                    OffsetDirection.OUTSET,
                    0.1,
                    5
                );

                const _insetResult = offsetSpline(
                    originalSpline,
                    25,
                    OffsetDirection.INSET,
                    0.1,
                    5
                );

                // Add some SVG content
                if (
                    originalResult.success &&
                    originalResult.shapes.length > 0
                ) {
                    const shape = originalResult.shapes[0];
                    if (shape.type === 'polyline') {
                        const polylineGeometry = shape.geometry as Polyline;
                        const points = polylineToPoints(polylineGeometry);
                        const pointsStr = points
                            .map((p) => `${p.x},${400 - p.y}`)
                            .join(' ');
                        svg += `  <polyline points="${pointsStr}" stroke="blue" stroke-width="1" fill="none"/>\n`;
                    }
                }
            });

            svg += '</svg>';

            writeFileSync(join(outputDir, 'combination-test.svg'), svg);

            expect(true).toBe(true);
        }
    );
});
