import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { offsetEllipse } from './ellipse';
import {
    GeometryType,
    type Shape,
    type Ellipse,
    type Spline,
    type Polyline,
    type Point2D,
} from '../../../../types/geometry';
import { polylineToPoints } from '../../../../geometry/polyline';
import verb from 'verb-nurbs';
import { OffsetDirection } from '../types';

/**
 * Visual validation test for ellipse offsets
 * Verifies that our true mathematical ellipse offset implementation matches the reference calculation
 * This test validates the fix for the "jagged saw blade" issue by using proper mathematical offset instead of Clipper2
 */
describe('Ellipse Offset Visual Validation', () => {
    const outputDir = 'tests/output/visual/offsets';

    // Create output directory
    beforeAll(() => {
        try {
            mkdirSync(outputDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    });

    /**
     * Calculates the true constant-distance offset points for an ellipse
     * This is the reference implementation from ellipse_offset.md
     */
    function _calculateTrueEllipticalOffsetPoints(
        ellipse: { cx: number; cy: number; rx: number; ry: number },
        offsetDistance: number,
        numSegments = 200
    ): Array<{ x: number; y: number }> {
        const points = [];
        const { cx, cy, rx, ry } = ellipse;
        const startT = 0;
        const endT = 2 * Math.PI;
        const deltaT = (endT - startT) / numSegments;

        for (let i: number = 0; i <= numSegments; i++) {
            const t: number = startT + i * deltaT;
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);

            // Point on the original ellipse
            const ellipseX = cx + rx * cosT;
            const ellipseY = cy + ry * sinT;

            // Normal vector components and magnitude
            const normalX = rx * cosT;
            const normalY = ry * sinT;
            const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2);

            if (magnitude === 0) continue;

            // Calculate the offset point
            const offsetX = ellipseX + offsetDistance * (normalX / magnitude);
            const offsetY = ellipseY + offsetDistance * (normalY / magnitude);

            points.push({ x: offsetX, y: offsetY });
        }
        return points;
    }

    /**
     * Generates comprehensive SVG showing multiple test cases with debug visualization
     */
    function generateComprehensiveSvg(): string {
        const svg = [];

        // SVG header with larger viewbox to accommodate multiple ellipses
        svg.push(
            `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">`
        );
        svg.push(
            `  <title>Ellipse Offset Validation: Multiple Test Cases</title>`
        );
        svg.push(
            `  <rect width="100%" height="100%" fill="white" stroke="lightgray" stroke-width="0.5"/>`
        );

        // Test case configurations
        const testCases = [
            {
                id: 1,
                name: 'Standard Ellipse (25 units outset)',
                center: { x: 200, y: 120 },
                rx: 80,
                ry: 40,
                offsetDistance: 25,
                direction: OffsetDirection.OUTSET,
            },
            {
                id: 2,
                name: 'Standard Ellipse (20 units inset)',
                center: { x: 500, y: 120 },
                rx: 80,
                ry: 40,
                offsetDistance: 20,
                direction: OffsetDirection.INSET,
            },
            {
                id: 3,
                name: 'Extreme Aspect Ratio (15 units outset)',
                center: { x: 200, y: 320 },
                rx: 100,
                ry: 15,
                offsetDistance: 15,
                direction: OffsetDirection.OUTSET,
            },
            {
                id: 4,
                name: 'Small with Large Offset (25 units outset)',
                center: { x: 500, y: 320 },
                rx: 30,
                ry: 20,
                offsetDistance: 25,
                direction: OffsetDirection.OUTSET,
            },
        ];

        testCases.forEach((testCase) => {
            const { id, name, center, rx, ry, offsetDistance, direction } =
                testCase;

            // Create ellipse shape for our implementation
            const ellipseShape: Shape = {
                id: `test-ellipse-${id}`,
                type: GeometryType.ELLIPSE,
                geometry: {
                    center,
                    majorAxisEndpoint: { x: rx, y: 0 },
                    minorToMajorRatio: ry / rx,
                },
            };

            // Get our implementation's result
            const approximatedResult = offsetEllipse(
                ellipseShape.geometry as Ellipse,
                offsetDistance,
                direction
            );
            const approximatedPoints =
                approximatedResult.success &&
                approximatedResult.shapes[0].type === 'polyline'
                    ? polylineToPoints(
                          approximatedResult.shapes[0].geometry as Polyline
                      )
                    : [];

            // Generate true offset points for comparison
            const numSamples = 64;
            const sampledTruePoints: Array<{ x: number; y: number }> = [];

            for (let i: number = 0; i < numSamples; i++) {
                const t: number = (i / numSamples) * 2 * Math.PI;
                const cosT = Math.cos(t);
                const sinT = Math.sin(t);

                const ellipseX = center.x + rx * cosT;
                const ellipseY = center.y + ry * sinT;

                const normalX = rx * cosT;
                const normalY = ry * sinT;
                const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2);

                if (magnitude === 0) continue;

                // Apply offset direction
                const actualOffset =
                    direction === OffsetDirection.OUTSET
                        ? offsetDistance
                        : -offsetDistance;
                const offsetX = ellipseX + actualOffset * (normalX / magnitude);
                const offsetY = ellipseY + actualOffset * (normalY / magnitude);

                sampledTruePoints.push({ x: offsetX, y: offsetY });
            }

            // Original ellipse
            svg.push(`  <!-- Test Case ${id}: ${name} -->`);
            svg.push(
                `  <ellipse cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}" stroke="blue" stroke-width="2" fill="none" />`
            );

            // True offset (reference) - green line
            if (sampledTruePoints.length > 0) {
                const truePathD =
                    'M ' +
                    sampledTruePoints
                        .map((p) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
                        .join(' L ') +
                    ' Z';
                svg.push(
                    `  <path d="${truePathD}" stroke="green" stroke-width="2" fill="none" opacity="0.8" />`
                );
            }

            // Our approximation - red dots for debug visualization
            if (approximatedPoints.length > 0) {
                // Show first 50 points as circles for debug visualization
                approximatedPoints
                    .slice(0, 50)
                    .forEach((point: Point2D, _idx: number) => {
                        svg.push(
                            `  <circle cx="${point.x}" cy="${point.y}" r="1" fill="red" opacity="0.6" />`
                        );
                    });

                // Also show as continuous path in red dashed line
                const approxPathD =
                    'M ' +
                    approximatedPoints
                        .map(
                            (p: Point2D) =>
                                `${p.x.toFixed(3)} ${p.y.toFixed(3)}`
                        )
                        .join(' L ') +
                    ' Z';
                svg.push(
                    `  <path d="${approxPathD}" stroke="red" stroke-width="1" fill="none" stroke-dasharray="3,2" opacity="0.8" />`
                );
            }

            // Test case number and label
            svg.push(
                `  <circle cx="${center.x - rx - 30}" cy="${center.y - ry - 10}" r="12" fill="white" stroke="black" stroke-width="1" />`
            );
            svg.push(
                `  <text x="${center.x - rx - 30}" y="${center.y - ry - 6}" fill="black" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold">${id}</text>`
            );
            svg.push(
                `  <text x="${center.x}" y="${center.y - ry - 20}" fill="black" text-anchor="middle" font-family="sans-serif" font-size="10">${name}</text>`
            );
        });

        // Legend
        svg.push(`  <!-- Legend -->`);
        svg.push(
            `  <rect x="50" y="520" width="700" height="70" fill="white" stroke="gray" stroke-width="1" rx="5" />`
        );
        svg.push(
            `  <text x="70" y="540" fill="black" font-family="sans-serif" font-size="14" font-weight="bold">Legend:</text>`
        );

        // Blue line sample
        svg.push(
            `  <line x1="70" y1="555" x2="90" y2="555" stroke="blue" stroke-width="2" />`
        );
        svg.push(
            `  <text x="95" y="559" fill="black" font-family="sans-serif" font-size="11">Original Ellipse</text>`
        );

        // Green line sample
        svg.push(
            `  <line x1="200" y1="555" x2="220" y2="555" stroke="green" stroke-width="2" />`
        );
        svg.push(
            `  <text x="225" y="559" fill="black" font-family="sans-serif" font-size="11">True Mathematical Offset</text>`
        );

        // Red dashed line sample
        svg.push(
            `  <line x1="380" y1="555" x2="400" y2="555" stroke="red" stroke-width="1" stroke-dasharray="3,2" />`
        );
        svg.push(
            `  <text x="405" y="559" fill="black" font-family="sans-serif" font-size="11">Our Implementation (Path)</text>`
        );

        // Red dot sample
        svg.push(
            `  <circle cx="580" cy="555" r="2" fill="red" opacity="0.6" />`
        );
        svg.push(
            `  <text x="590" y="559" fill="black" font-family="sans-serif" font-size="11">Debug Points (First 50)</text>`
        );

        // Additional info
        svg.push(
            `  <text x="70" y="580" fill="gray" font-family="sans-serif" font-size="10">Perfect overlap of green and red indicates accurate implementation. Red dots show point distribution.</text>`
        );

        svg.push(`</svg>`);

        return svg.join('\n');
    }

    /**
     * Calculates the maximum deviation between two point arrays
     */
    function _calculateMaxDeviation(
        points1: Array<{ x: number; y: number }>,
        points2: Array<{ x: number; y: number }>
    ): number {
        if (points1.length !== points2.length) {
            throw new Error('Point arrays must have the same length');
        }

        let maxDeviation = 0;
        for (let i: number = 0; i < points1.length; i++) {
            const dx: number = points1[i].x - points2[i].x;
            const dy: number = points1[i].y - points2[i].y;
            const deviation = Math.sqrt(dx * dx + dy * dy);
            maxDeviation = Math.max(maxDeviation, deviation);
        }
        return maxDeviation;
    }

    it('should validate ellipse offset accuracy', () => {
        const center = { x: 250, y: 150 };
        const rx = 150;
        const ry = 75;

        const ellipseShape: Shape = {
            id: 'test-ellipse-1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center,
                majorAxisEndpoint: { x: rx, y: 0 }, // Major axis along X direction
                minorToMajorRatio: ry / rx,
            },
        };
        const offsetDistance = 25;

        // Get our implementation's result
        const approximatedResult = offsetEllipse(
            ellipseShape.geometry as Ellipse,
            offsetDistance,
            OffsetDirection.OUTSET
        );

        expect(approximatedResult.success).toBe(true);

        if (!approximatedResult.success) return;

        // Convert our result to points (handle both polyline and spline)
        let approximatedPoints: Array<{ x: number; y: number }> = [];

        if (approximatedResult.shapes[0].type === 'polyline') {
            approximatedPoints = polylineToPoints(
                approximatedResult.shapes[0].geometry as Polyline
            );
        } else if (approximatedResult.shapes[0].type === 'spline') {
            // For splines, we need to sample points ON the curve (not control points)
            const splineGeometry = approximatedResult.shapes[0]
                .geometry as Spline;

            try {
                // Recreate the NURBS curve from the spline geometry using verb static method
                const controlPoints3D = splineGeometry.controlPoints.map(
                    (p: Point2D) => [p.x, p.y, 0]
                );
                const nurbsCurve =
                    verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                        splineGeometry.degree,
                        splineGeometry.knots,
                        controlPoints3D,
                        splineGeometry.weights
                    );

                // Sample points evenly along the curve
                const numSamples = 64; // Match our comparison sample count
                approximatedPoints = [];

                for (let i: number = 0; i < numSamples; i++) {
                    const t: number = i / (numSamples - 1); // Parameter from 0 to 1
                    const point3D = nurbsCurve.point(t);
                    approximatedPoints.push({ x: point3D[0], y: point3D[1] });
                }
            } catch {
                approximatedPoints = splineGeometry.controlPoints;
            }
        }

        // For visual validation, we'll sample points from the true offset at the same parameter values
        // that our implementation uses, rather than trying to compare different sampling strategies

        // Our implementation uses 64 points around the ellipse, let's match that
        const numSamples = 64;
        const sampledTruePoints: Array<{ x: number; y: number }> = [];

        for (let i: number = 0; i < numSamples; i++) {
            const t: number = (i / numSamples) * 2 * Math.PI;
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);

            // Point on the original ellipse
            const ellipseX = center.x + rx * cosT;
            const ellipseY = center.y + ry * sinT;

            // Normal vector components and magnitude
            const normalX = rx * cosT;
            const normalY = ry * sinT;
            const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2);

            if (magnitude === 0) continue;

            // Calculate the offset point
            const offsetX = ellipseX + offsetDistance * (normalX / magnitude);
            const offsetY = ellipseY + offsetDistance * (normalY / magnitude);

            sampledTruePoints.push({ x: offsetX, y: offsetY });
        }

        // The approximated points may have a different distribution due to our implementation
        // So we'll find the closest approximated point to each true sample point

        let totalDeviation = 0;
        let maxDeviation = 0;

        // For each true sample point, find the closest approximated point
        for (const truePoint of sampledTruePoints) {
            let closestDistance = Infinity;

            for (const approxPoint of approximatedPoints) {
                const dx: number = approxPoint.x - truePoint.x;
                const dy: number = approxPoint.y - truePoint.y;
                const distance: number = Math.sqrt(dx * dx + dy * dy);

                if (distance < closestDistance) {
                    closestDistance = distance;
                }
            }

            totalDeviation += closestDistance;
            maxDeviation = Math.max(maxDeviation, closestDistance);
        }

        const avgDeviation = totalDeviation / sampledTruePoints.length;

        // Generate comprehensive SVG with all test cases and debug visualization
        const svg = generateComprehensiveSvg();

        // Write single comprehensive SVG file
        writeFileSync(`${outputDir}/ellipse-offset-validation.svg`, svg);

        // With true mathematical offset via NURBS approximation, we expect good accuracy
        // The deviation should be reasonable for the NURBS-based offset approach
        expect(maxDeviation).toBeLessThan(10); // Within 10 units (acceptable for complex curves)
        expect(avgDeviation).toBeLessThan(5); // Average within 5 units (acceptable for complex curves)
    });

    it('should accurately approximate inset ellipse offset', () => {
        const center = { x: 250, y: 150 };
        const rx = 150;
        const ry = 75;

        const ellipseShape: Shape = {
            id: 'test-ellipse-2',
            type: GeometryType.ELLIPSE,
            geometry: {
                center,
                majorAxisEndpoint: { x: rx, y: 0 }, // Major axis along X direction
                minorToMajorRatio: ry / rx,
            },
        };
        const offsetDistance = 25;

        // Get our implementation's result
        const approximatedResult = offsetEllipse(
            ellipseShape.geometry as Ellipse,
            offsetDistance,
            OffsetDirection.INSET
        );
        expect(approximatedResult.success).toBe(true);

        if (!approximatedResult.success) return;

        // Convert our result to points (handle both polyline and spline)
        let approximatedPoints: Array<{ x: number; y: number }> = [];

        if (approximatedResult.shapes[0].type === 'polyline') {
            approximatedPoints = polylineToPoints(
                approximatedResult.shapes[0].geometry as Polyline
            );
        } else if (approximatedResult.shapes[0].type === 'spline') {
            // For splines, we need to sample points ON the curve (not control points)
            const splineGeometry = approximatedResult.shapes[0]
                .geometry as Spline;

            try {
                // Recreate the NURBS curve from the spline geometry using verb static method
                const controlPoints3D = splineGeometry.controlPoints.map(
                    (p: Point2D) => [p.x, p.y, 0]
                );
                const nurbsCurve =
                    verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                        splineGeometry.degree,
                        splineGeometry.knots,
                        controlPoints3D,
                        splineGeometry.weights
                    );

                // Sample points evenly along the curve
                const numSamples = 64; // Match our comparison sample count
                approximatedPoints = [];

                for (let i: number = 0; i < numSamples; i++) {
                    const t: number = i / (numSamples - 1); // Parameter from 0 to 1
                    const point3D = nurbsCurve.point(t);
                    approximatedPoints.push({ x: point3D[0], y: point3D[1] });
                }
            } catch {
                approximatedPoints = splineGeometry.controlPoints;
            }
        }

        // Generate true offset points at the same parameter positions
        const numSamples = 64;
        const sampledTruePoints: Array<{ x: number; y: number }> = [];

        for (let i: number = 0; i < numSamples; i++) {
            const t: number = (i / numSamples) * 2 * Math.PI;
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);

            // Point on the original ellipse
            const ellipseX = center.x + rx * cosT;
            const ellipseY = center.y + ry * sinT;

            // Normal vector components and magnitude
            const normalX = rx * cosT;
            const normalY = ry * sinT;
            const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2);

            if (magnitude === 0) continue;

            // Calculate the inset offset point (negative offset)
            const offsetX = ellipseX - offsetDistance * (normalX / magnitude);
            const offsetY = ellipseY - offsetDistance * (normalY / magnitude);

            sampledTruePoints.push({ x: offsetX, y: offsetY });
        }

        // Find closest approximated point to each true sample point
        let totalDeviation = 0;
        let maxDeviation = 0;

        for (const truePoint of sampledTruePoints) {
            let closestDistance = Infinity;

            for (const approxPoint of approximatedPoints) {
                const dx: number = approxPoint.x - truePoint.x;
                const dy: number = approxPoint.y - truePoint.y;
                const distance: number = Math.sqrt(dx * dx + dy * dy);

                if (distance < closestDistance) {
                    closestDistance = distance;
                }
            }

            totalDeviation += closestDistance;
            maxDeviation = Math.max(maxDeviation, closestDistance);
        }

        const avgDeviation = totalDeviation / sampledTruePoints.length;

        // With true mathematical offset via NURBS approximation, inset should also be reasonably accurate
        expect(maxDeviation).toBeLessThan(10); // Within 10 units (acceptable for complex curves)
        expect(avgDeviation).toBeLessThan(5); // Average within 5 units (acceptable for complex curves)
    });

    it('should handle extreme aspect ratio ellipses', () => {
        const center = { x: 200, y: 100 };
        const rx = 180; // Very wide
        const ry = 20; // Very narrow

        const ellipseShape: Shape = {
            id: 'test-ellipse-3',
            type: GeometryType.ELLIPSE,
            geometry: {
                center,
                majorAxisEndpoint: { x: rx, y: 0 }, // Major axis along X direction
                minorToMajorRatio: ry / rx,
            },
        };
        const offsetDistance = 15;

        // Get our implementation's result
        const approximatedResult = offsetEllipse(
            ellipseShape.geometry as Ellipse,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        expect(approximatedResult.success).toBe(true);

        if (!approximatedResult.success) return;

        // Convert our result to points (handle both polyline and spline)
        let approximatedPoints: Array<{ x: number; y: number }> = [];

        if (approximatedResult.shapes[0].type === 'polyline') {
            approximatedPoints = polylineToPoints(
                approximatedResult.shapes[0].geometry as Polyline
            );
        } else if (approximatedResult.shapes[0].type === 'spline') {
            // For splines, we need to sample points ON the curve (not control points)
            const splineGeometry = approximatedResult.shapes[0]
                .geometry as Spline;

            try {
                // Recreate the NURBS curve from the spline geometry using verb static method
                const controlPoints3D = splineGeometry.controlPoints.map(
                    (p: Point2D) => [p.x, p.y, 0]
                );
                const nurbsCurve =
                    verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                        splineGeometry.degree,
                        splineGeometry.knots,
                        controlPoints3D,
                        splineGeometry.weights
                    );

                // Sample points evenly along the curve
                const numSamples = 64; // Match our comparison sample count
                approximatedPoints = [];

                for (let i: number = 0; i < numSamples; i++) {
                    const t: number = i / (numSamples - 1); // Parameter from 0 to 1
                    const point3D = nurbsCurve.point(t);
                    approximatedPoints.push({ x: point3D[0], y: point3D[1] });
                }
            } catch {
                approximatedPoints = splineGeometry.controlPoints;
            }
        }

        // Generate true offset points
        const numSamples = 64;
        const sampledTruePoints: Array<{ x: number; y: number }> = [];

        for (let i: number = 0; i < numSamples; i++) {
            const t: number = (i / numSamples) * 2 * Math.PI;
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);

            const ellipseX = center.x + rx * cosT;
            const ellipseY = center.y + ry * sinT;

            const normalX = rx * cosT;
            const normalY = ry * sinT;
            const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2);

            if (magnitude === 0) continue;

            const offsetX = ellipseX + offsetDistance * (normalX / magnitude);
            const offsetY = ellipseY + offsetDistance * (normalY / magnitude);

            sampledTruePoints.push({ x: offsetX, y: offsetY });
        }

        // Find closest approximated point to each true sample point
        let totalDeviation = 0;
        let maxDeviation = 0;

        for (const truePoint of sampledTruePoints) {
            let closestDistance = Infinity;

            for (const approxPoint of approximatedPoints) {
                const dx: number = approxPoint.x - truePoint.x;
                const dy: number = approxPoint.y - truePoint.y;
                const distance: number = Math.sqrt(dx * dx + dy * dy);

                if (distance < closestDistance) {
                    closestDistance = distance;
                }
            }

            totalDeviation += closestDistance;
            maxDeviation = Math.max(maxDeviation, closestDistance);
        }

        const avgDeviation = totalDeviation / sampledTruePoints.length;

        // Even extreme aspect ratios should be reasonably accurate with NURBS approximation
        expect(maxDeviation).toBeLessThan(10); // Within 10 units (acceptable for extreme ellipses)
        expect(avgDeviation).toBeLessThan(5); // Average within 5 units (acceptable for extreme ellipses)
    });

    it('should handle small ellipses with large offsets', () => {
        const center = { x: 100, y: 100 };
        const rx = 30;
        const ry = 20;

        const ellipseShape: Shape = {
            id: 'test-ellipse-4',
            type: GeometryType.ELLIPSE,
            geometry: {
                center,
                majorAxisEndpoint: { x: rx, y: 0 }, // Major axis along X direction
                minorToMajorRatio: ry / rx,
            },
        };
        const offsetDistance = 25; // Large offset relative to ellipse size

        // Get our implementation's result
        const approximatedResult = offsetEllipse(
            ellipseShape.geometry as Ellipse,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        expect(approximatedResult.success).toBe(true);

        if (!approximatedResult.success) return;

        // Convert our result to points (handle both polyline and spline)
        let approximatedPoints: Array<{ x: number; y: number }> = [];

        if (approximatedResult.shapes[0].type === 'polyline') {
            approximatedPoints = polylineToPoints(
                approximatedResult.shapes[0].geometry as Polyline
            );
        } else if (approximatedResult.shapes[0].type === 'spline') {
            // For splines, we need to sample points ON the curve (not control points)
            const splineGeometry = approximatedResult.shapes[0]
                .geometry as Spline;

            try {
                // Recreate the NURBS curve from the spline geometry using verb static method
                const controlPoints3D = splineGeometry.controlPoints.map(
                    (p: Point2D) => [p.x, p.y, 0]
                );
                const nurbsCurve =
                    verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                        splineGeometry.degree,
                        splineGeometry.knots,
                        controlPoints3D,
                        splineGeometry.weights
                    );

                // Sample points evenly along the curve
                const numSamples = 64; // Match our comparison sample count
                approximatedPoints = [];

                for (let i: number = 0; i < numSamples; i++) {
                    const t: number = i / (numSamples - 1); // Parameter from 0 to 1
                    const point3D = nurbsCurve.point(t);
                    approximatedPoints.push({ x: point3D[0], y: point3D[1] });
                }
            } catch {
                approximatedPoints = splineGeometry.controlPoints;
            }
        }

        // Generate true offset points
        const numSamples = 64;
        const sampledTruePoints: Array<{ x: number; y: number }> = [];

        for (let i: number = 0; i < numSamples; i++) {
            const t: number = (i / numSamples) * 2 * Math.PI;
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);

            const ellipseX = center.x + rx * cosT;
            const ellipseY = center.y + ry * sinT;

            const normalX = rx * cosT;
            const normalY = ry * sinT;
            const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2);

            if (magnitude === 0) continue;

            const offsetX = ellipseX + offsetDistance * (normalX / magnitude);
            const offsetY = ellipseY + offsetDistance * (normalY / magnitude);

            sampledTruePoints.push({ x: offsetX, y: offsetY });
        }

        // Find closest approximated point to each true sample point
        let totalDeviation = 0;
        let maxDeviation = 0;

        for (const truePoint of sampledTruePoints) {
            let closestDistance = Infinity;

            for (const approxPoint of approximatedPoints) {
                const dx: number = approxPoint.x - truePoint.x;
                const dy: number = approxPoint.y - truePoint.y;
                const distance: number = Math.sqrt(dx * dx + dy * dy);

                if (distance < closestDistance) {
                    closestDistance = distance;
                }
            }

            totalDeviation += closestDistance;
            maxDeviation = Math.max(maxDeviation, closestDistance);
        }

        const avgDeviation = totalDeviation / sampledTruePoints.length;

        // Large offsets on small shapes should still be reasonably accurate with NURBS approximation
        expect(maxDeviation).toBeLessThan(10.0); // Within 10.0 units (acceptable accuracy for challenging case)
        expect(avgDeviation).toBeLessThan(5.0); // Average within 5.0 units (acceptable accuracy for challenging case)
    });
});
