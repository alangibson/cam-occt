import { describe, expect, it } from 'vitest';
import { offsetSpline } from './spline';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { createVerbCurveFromSpline } from '$lib/geometry/spline/nurbs';
import type { Spline } from '$lib/geometry/spline';

describe('verb integration test for offset splines', () => {
    function createTestSpline(): Spline {
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

    it('should be able to convert offset spline back to verb curve', () => {
        const spline = createTestSpline();
        const result = offsetSpline(spline, 1, OffsetDirection.OUTSET, 0.1);

        expect(result.success).toBe(true);
        const offsetGeometry = result.shapes[0].geometry as Spline;

        // Try to convert the offset spline back to a verb curve
        // This is what the system does internally and might be where the error occurs
        expect(() => {
            const verbCurve = createVerbCurveFromSpline(offsetGeometry);

            console.log('=== VERB CURVE CREATION TEST ===');
            console.log('Verb curve created successfully');
            console.log('Verb curve degree:', verbCurve.degree());
            console.log(
                'Verb curve control points:',
                verbCurve.controlPoints().length
            );
            console.log('Verb curve knots:', verbCurve.knots().length);

            // Test basic operations that might be used in leads calculation
            const startPoint = verbCurve.point(0);
            const endPoint = verbCurve.point(1);
            const midPoint = verbCurve.point(0.5);

            console.log('Start point:', startPoint);
            console.log('End point:', endPoint);
            console.log('Mid point:', midPoint);

            // Test derivative calculation (used in normal calculation)
            const startDerivatives = verbCurve.derivatives(0, 1);
            const endDerivatives = verbCurve.derivatives(1, 1);

            console.log('Start derivatives:', startDerivatives);
            console.log('End derivatives:', endDerivatives);

            // Validate all operations succeeded
            expect(startPoint).toBeDefined();
            expect(endPoint).toBeDefined();
            expect(midPoint).toBeDefined();
            expect(startDerivatives).toBeDefined();
            expect(endDerivatives).toBeDefined();
        }).not.toThrow();
    });

    it('should handle multiple offset operations without errors', () => {
        const spline = createTestSpline();

        // Test multiple offsets in sequence
        const outsetResult = offsetSpline(
            spline,
            1,
            OffsetDirection.OUTSET,
            0.1
        );
        expect(outsetResult.success).toBe(true);

        const insetResult = offsetSpline(spline, 1, OffsetDirection.INSET, 0.1);
        expect(insetResult.success).toBe(true);

        // Try to convert both results to verb curves
        const outsetGeometry = outsetResult.shapes[0].geometry as Spline;
        const insetGeometry = insetResult.shapes[0].geometry as Spline;

        expect(() => {
            const outsetVerb = createVerbCurveFromSpline(outsetGeometry);
            const insetVerb = createVerbCurveFromSpline(insetGeometry);

            // Test that both can be evaluated
            outsetVerb.point(0.5);
            insetVerb.point(0.5);
        }).not.toThrow();
    });

    it('should create splines compatible with intersection operations', () => {
        const spline = createTestSpline();
        const result = offsetSpline(spline, 1, OffsetDirection.OUTSET, 0.1);

        const offsetGeometry = result.shapes[0].geometry as Spline;
        const verbCurve = createVerbCurveFromSpline(offsetGeometry);

        // Test operations commonly used in intersection calculations
        expect(() => {
            // These operations are typically used in leads/intersection calculations
            const domain = verbCurve.domain();
            console.log('Curve domain:', domain);

            // Note: boundingBox method may not be available in this version of verb
            // const boundingBox = verbCurve.boundingBox();
            // console.log('Bounding box:', boundingBox);

            // Test tessellation (used for visualization)
            const tessellation = verbCurve.tessellate(0.1);
            console.log('Tessellation points:', tessellation.length);

            expect(domain).toBeDefined();
            expect(tessellation.length).toBeGreaterThan(0);
        }).not.toThrow();
    });

    it('should preserve spline properties through offset and conversion cycle', () => {
        const spline = createTestSpline();
        const result = offsetSpline(spline, 1, OffsetDirection.OUTSET, 0.1);

        const offsetGeometry = result.shapes[0].geometry as Spline;

        // Check that fundamental properties are preserved
        expect(offsetGeometry.degree).toBe(spline.degree);
        expect(offsetGeometry.closed).toBe(spline.closed);

        // Check knot vector validity
        const expectedKnots =
            offsetGeometry.controlPoints.length + offsetGeometry.degree + 1;
        expect(offsetGeometry.knots.length).toBe(expectedKnots);

        // Verify verb conversion works
        const verbCurve = createVerbCurveFromSpline(offsetGeometry);
        expect(verbCurve.degree()).toBe(offsetGeometry.degree);
        expect(verbCurve.controlPoints().length).toBe(
            offsetGeometry.controlPoints.length
        );
        expect(verbCurve.knots().length).toBe(offsetGeometry.knots.length);
    });
});
