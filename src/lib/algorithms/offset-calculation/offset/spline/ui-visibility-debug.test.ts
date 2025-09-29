import { describe, expect, it } from 'vitest';
import { offsetSpline } from './spline';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { Spline } from '$lib/geometry/spline';

describe('UI visibility debug for offset splines', () => {
    function createSimpleSpline(): Spline {
        return {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 2, y: 4 },
                { x: 6, y: 4 },
                { x: 8, y: 0 },
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            degree: 3,
            fitPoints: [],
            closed: false,
        };
    }

    it('should generate offset spline with all required properties for UI rendering', () => {
        const spline = createSimpleSpline();
        const result = offsetSpline(spline, 1, OffsetDirection.OUTSET, 0.1);

        console.log('=== OFFSET SPLINE DEBUG ===');
        console.log('Result success:', result.success);
        console.log('Number of shapes:', result.shapes.length);
        console.log('Warnings:', result.warnings);

        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);

        const offsetShape = result.shapes[0];
        console.log('Shape type:', offsetShape.type);
        console.log('Shape ID:', offsetShape.id);

        const offsetGeometry = offsetShape.geometry as Spline;

        // Check all properties required for UI rendering
        console.log('=== SPLINE GEOMETRY ===');
        console.log(
            'Control points count:',
            offsetGeometry.controlPoints.length
        );
        console.log('Control points:', offsetGeometry.controlPoints);
        console.log('Degree:', offsetGeometry.degree);
        console.log('Knots count:', offsetGeometry.knots.length);
        console.log('Knots:', offsetGeometry.knots);
        console.log('Weights count:', offsetGeometry.weights?.length);
        console.log('Weights:', offsetGeometry.weights);
        console.log('Closed:', offsetGeometry.closed);
        console.log('Fit points count:', offsetGeometry.fitPoints.length);
        console.log('Fit points:', offsetGeometry.fitPoints);

        // Validate all required properties exist and are valid
        expect(offsetGeometry.controlPoints).toBeDefined();
        expect(offsetGeometry.controlPoints.length).toBeGreaterThan(0);
        expect(offsetGeometry.degree).toBeDefined();
        expect(offsetGeometry.knots).toBeDefined();
        expect(offsetGeometry.knots.length).toBeGreaterThan(0);
        expect(offsetGeometry.weights).toBeDefined();
        expect(offsetGeometry.closed).toBeDefined();
        expect(offsetGeometry.fitPoints).toBeDefined();

        // Check knot vector validity (the validation that was causing errors)
        const expectedKnots =
            offsetGeometry.controlPoints.length + offsetGeometry.degree + 1;
        console.log('Expected knots:', expectedKnots);
        console.log('Actual knots:', offsetGeometry.knots.length);
        expect(offsetGeometry.knots.length).toBe(expectedKnots);

        // Check that control points have proper coordinates
        for (const cp of offsetGeometry.controlPoints) {
            expect(cp.x).toBeDefined();
            expect(cp.y).toBeDefined();
            expect(typeof cp.x).toBe('number');
            expect(typeof cp.y).toBe('number');
            expect(isFinite(cp.x)).toBe(true);
            expect(isFinite(cp.y)).toBe(true);
        }

        console.log('=== VALIDATION COMPLETE ===');
    });

    it('should generate different offset than original', () => {
        const spline = createSimpleSpline();
        const result = offsetSpline(spline, 1, OffsetDirection.OUTSET, 0.1);

        const offsetGeometry = result.shapes[0].geometry as Spline;

        // Check that the offset actually changed the geometry
        let hasSignificantChange = false;
        for (let i = 0; i < offsetGeometry.controlPoints.length; i++) {
            const originalCP = spline.controlPoints[i];
            const offsetCP = offsetGeometry.controlPoints[i];

            const distance = Math.sqrt(
                (offsetCP.x - originalCP.x) ** 2 +
                    (offsetCP.y - originalCP.y) ** 2
            );

            if (distance > 0.1) {
                hasSignificantChange = true;
                console.log(
                    `Control point ${i} moved by ${distance.toFixed(3)}`
                );
            }
        }

        expect(hasSignificantChange).toBe(true);
    });

    it('should compare with degree 2 spline offset to ensure we get similar structure', () => {
        const degree3Spline = createSimpleSpline();

        const degree2Spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 4, y: 4 },
                { x: 8, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const degree3Result = offsetSpline(
            degree3Spline,
            1,
            OffsetDirection.OUTSET,
            0.1
        );
        const degree2Result = offsetSpline(
            degree2Spline,
            1,
            OffsetDirection.OUTSET,
            0.1
        );

        console.log('=== DEGREE COMPARISON ===');
        console.log('Degree 3 result success:', degree3Result.success);
        console.log('Degree 2 result success:', degree2Result.success);

        expect(degree3Result.success).toBe(true);
        expect(degree2Result.success).toBe(true);

        const degree3Geometry = degree3Result.shapes[0].geometry as Spline;
        const degree2Geometry = degree2Result.shapes[0].geometry as Spline;

        console.log(
            'Degree 3 control points:',
            degree3Geometry.controlPoints.length
        );
        console.log(
            'Degree 2 control points:',
            degree2Geometry.controlPoints.length
        );
        console.log('Degree 3 type:', degree3Result.shapes[0].type);
        console.log('Degree 2 type:', degree2Result.shapes[0].type);

        // Both should have the expected structure
        expect(degree3Geometry.controlPoints.length).toBe(91);
        expect(degree2Geometry.controlPoints.length).toBeGreaterThanOrEqual(3);
    });
});
