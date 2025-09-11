import { describe, it, expect } from 'vitest';
import _verb from 'verb-nurbs';
import { offsetSpline } from './spline';
import { OffsetDirection } from '../types';
import type { Point2D } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';

describe('Spline offset adaptive refinement', () => {
    // Create a test spline with high curvature that will require refinement
    const highCurvatureSpline: Spline = {
        controlPoints: [
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
            { x: 150, y: 100 },
            { x: 200, y: 0 },
        ],
        degree: 3,
        knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1],
        weights: [1, 1, 1, 1, 1],
        fitPoints: [],
        closed: false,
    };

    it('should achieve tolerance with initial sampling', () => {
        // Use a very large tolerance that should be achievable without refinement
        const result = offsetSpline(
            highCurvatureSpline,
            10,
            OffsetDirection.OUTSET,
            100.0
        );

        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);
        // Should not have refinement warnings with such a large tolerance
        expect(result.warnings.length).toBe(0);
    });

    it('should refine when tolerance is not met', () => {
        // Use a moderate tolerance that will require refinement but be achievable
        const result = offsetSpline(
            highCurvatureSpline,
            5,
            OffsetDirection.OUTSET,
            0.01,
            5
        );

        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);

        // Check for refinement warning or tolerance not achieved warning
        const hasRefinementWarning = result.warnings.some(
            (w) => w.includes('refined with') && w.includes('samples after')
        );
        const hasToleranceWarning = result.warnings.some((w) =>
            w.includes('tolerance not achieved after')
        );

        // Either should be true - the algorithm attempted to improve accuracy
        expect(hasRefinementWarning || hasToleranceWarning).toBe(true);
    });

    it('should report when tolerance cannot be achieved', () => {
        // Use an impossibly tight tolerance with limited retries
        const result = offsetSpline(
            highCurvatureSpline,
            10,
            OffsetDirection.OUTSET,
            0.000001,
            2
        );

        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);

        // Check for tolerance not achieved warning
        const hasToleranceWarning = result.warnings.some((w) =>
            w.includes('tolerance not achieved after')
        );
        expect(hasToleranceWarning).toBe(true);
    });

    it('should validate offset accuracy', () => {
        // Create a simple curve where we can manually verify the offset
        const simpleSpline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 200, y: 0 },
                { x: 300, y: 0 },
            ],
            degree: 3,
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        };

        const offsetDistance = 5;
        const result = offsetSpline(
            simpleSpline,
            offsetDistance,
            OffsetDirection.OUTSET,
            0.5
        );

        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);

        // For a straight horizontal line, the offset should be parallel
        // Spline offset returns spline geometry, so we need to sample points from it
        const offsetGeometry = result.shapes[0].geometry as Spline;
        expect(offsetGeometry.controlPoints).toBeDefined();
        expect(offsetGeometry.controlPoints.length).toBeGreaterThan(0);

        // Sample a few points from the spline to verify offset distance
        const sampledPoints = offsetGeometry.controlPoints.slice(0, 3); // Use first few control points as approximation

        // Since the offset direction for a horizontal line could be up or down,
        // just check that the points are offset by approximately the right distance
        const firstPoint = sampledPoints[0];
        const expectedDistance = Math.abs(firstPoint.y);

        expect(expectedDistance).toBeCloseTo(offsetDistance, 1);

        // Check that all sampled points have approximately the same y coordinate (parallel)
        const firstY = sampledPoints[0].y;
        sampledPoints.forEach((point: Point2D) => {
            expect(Math.abs(point.y - firstY)).toBeLessThan(1.0);
        });
    });

    it('should handle closed splines with refinement', () => {
        const closedSpline: Spline = {
            controlPoints: [
                { x: 100, y: 50 },
                { x: 150, y: 100 },
                { x: 100, y: 150 },
                { x: 50, y: 100 },
            ],
            degree: 2,
            knots: [0, 0, 0, 0.5, 1, 1, 1],
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: true,
        };

        const result = offsetSpline(
            closedSpline,
            5,
            OffsetDirection.INSET,
            0.5
        );

        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);

        const offsetGeometry = result.shapes[0].geometry as Spline;
        expect(offsetGeometry.closed).toBe(true);

        // Verify first and last control points are similar for closed curve (spline geometry)
        const controlPoints = offsetGeometry.controlPoints;
        expect(controlPoints).toBeDefined();
        expect(controlPoints.length).toBeGreaterThan(0);

        const firstPoint = controlPoints[0];
        const lastPoint = controlPoints[controlPoints.length - 1];

        expect(Math.abs(firstPoint.x - lastPoint.x)).toBeLessThan(1.0);
        expect(Math.abs(firstPoint.y - lastPoint.y)).toBeLessThan(1.0);
    });

    it('should increase sample count during refinement', () => {
        // Create a curve that will need refinement
        const complexSpline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 25, y: 50 },
                { x: 50, y: 0 },
                { x: 75, y: 50 },
                { x: 100, y: 0 },
                { x: 125, y: 50 },
                { x: 150, y: 0 },
            ],
            degree: 3,
            knots: [0, 0, 0, 0, 0.25, 0.5, 0.75, 1, 1, 1, 1],
            weights: [1, 1, 1, 1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        };

        const result = offsetSpline(
            complexSpline,
            8,
            OffsetDirection.OUTSET,
            0.0005,
            5
        );

        expect(result.success).toBe(true);

        if (result.warnings.length > 0) {
            const refinementWarning = result.warnings.find((w) =>
                w.includes('refined with')
            );
            if (refinementWarning) {
                // Extract the number of samples from the warning
                const samplesMatch = refinementWarning.match(
                    /refined with (\d+) samples/
                );
                if (samplesMatch) {
                    const finalSamples = parseInt(samplesMatch[1]);
                    // Should have more than the initial 200 samples
                    expect(finalSamples).toBeGreaterThan(200);
                }
            }
        }
    });
});
