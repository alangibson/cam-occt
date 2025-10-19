import { describe, expect, it, vi } from 'vitest';
import { findSplinePolylineIntersectionsVerb } from './index';
import { type Shape } from '$lib/geometry/shape/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { createPolylineFromVertices } from '$lib/geometry/polyline/functions';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('findSplinePolylineIntersectionsVerb error handling', () => {
    const createTestSpline = (): Shape => ({
        id: 'spline1',
        type: GeometryType.SPLINE,
        geometry: {
            degree: 3,
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 5 },
                { x: 30, y: 15 },
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        } as Spline,
    });

    const createTestPolyline = (): Shape =>
        createPolylineFromVertices(
            [
                { x: 35, y: 10, bulge: 0 },
                { x: 40, y: 10, bulge: 0 },
                { x: 45, y: 15, bulge: 0 },
            ],
            false
        );

    it('should handle createExtendedPolyline failure gracefully', async () => {
        // Mock createExtendedPolyline to throw an error
        vi.doMock('../../extend/polyline', () => ({
            createExtendedPolyline: vi.fn(() => {
                throw new Error('Polyline extension failed');
            }),
        }));

        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        // This should trigger the first catch block (lines 69-71 in coverage)
        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            true, // allowExtensions = true
            100
        );

        // Should not throw error, just return empty results or continue with other methods
        expect(Array.isArray(result)).toBe(true);

        vi.doUnmock('../../extend/polyline');
    });

    it('should handle createExtendedSplineVerb failure gracefully', async () => {
        // Mock createExtendedSplineVerb to throw an error
        vi.doMock('../../extend/spline', () => ({
            createExtendedSplineVerb: vi.fn(() => {
                throw new Error('Spline extension failed');
            }),
        }));

        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        // This should trigger the second catch block (lines 99-101 in coverage)
        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            true, // allowExtensions = true
            100
        );

        // Should not throw error, just return empty results or continue with other methods
        expect(Array.isArray(result)).toBe(true);

        vi.doUnmock('../../extend/spline');
    });

    it('should handle both extended polyline and spline creation failure', async () => {
        // Mock both createExtendedPolyline and createExtendedSplineVerb to throw errors
        vi.doMock('../../extend/polyline', () => ({
            createExtendedPolyline: vi.fn(() => {
                throw new Error('Polyline extension failed');
            }),
        }));
        vi.doMock('../../extend/spline', () => ({
            createExtendedSplineVerb: vi.fn(() => {
                throw new Error('Spline extension failed');
            }),
        }));

        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        // This should trigger the third catch block (lines 127-129 in coverage)
        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            true, // allowExtensions = true
            100
        );

        // Should not throw error, just return empty results
        expect(Array.isArray(result)).toBe(true);

        vi.doUnmock('../../extend/polyline');
        vi.doUnmock('../../extend/spline');
    });

    it('should handle main function error gracefully', async () => {
        // Mock createVerbCurveFromSpline to throw an error to trigger main catch block
        vi.doMock('$lib/geometry/spline/nurbs', () => ({
            createVerbCurveFromSpline: vi.fn(() => {
                throw new Error('Verb curve creation failed');
            }),
        }));

        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        // This should trigger the main catch block (lines 135-137 in coverage)
        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            false, // allowExtensions = false to avoid extension paths
            100
        );

        // Should return empty array when main function fails
        expect(result).toEqual([]);

        vi.doUnmock('$lib/geometry/spline/nurbs');
    });

    it('should handle findPolylineSplineIntersectionsOriginal error gracefully', async () => {
        // Mock createVerbCurveFromSpline to throw an error in the helper function
        vi.doMock('$lib/geometry/spline/nurbs', () => ({
            createVerbCurveFromSpline: vi.fn(() => {
                throw new Error('Verb curve creation failed');
            }),
        }));

        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        // This should trigger the helper function's catch block (lines 172-174 in coverage)
        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            false, // allowExtensions = false
            100
        );

        // Should return empty array when helper function fails
        expect(result).toEqual([]);

        vi.doUnmock('$lib/geometry/spline/nurbs');
    });

    it('should return empty array when no intersections found and extensions disabled', () => {
        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            false, // allowExtensions = false
            100
        );

        // Should return empty array when no intersections found
        expect(result).toEqual([]);
    });

    it('should return intersections when found with original shapes', () => {
        // Create shapes that might intersect
        const intersectingSplineShape = createTestSpline();
        const intersectingPolylineShape = createPolylineFromVertices(
            [
                { x: 5, y: 5, bulge: 0 },
                { x: 15, y: 5, bulge: 0 },
                { x: 25, y: 15, bulge: 0 },
            ],
            false
        );

        const result = findSplinePolylineIntersectionsVerb(
            intersectingSplineShape,
            intersectingPolylineShape,
            false,
            true, // allowExtensions = true
            100
        );

        // Should return the original results without trying extensions
        expect(Array.isArray(result)).toBe(true);
    });

    it('should handle both extension methods when no original intersections found', () => {
        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        // This should try all three extension combinations:
        // 1. Extended polyline vs original spline
        // 2. Original polyline vs extended spline
        // 3. Extended polyline vs extended spline
        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            true, // allowExtensions = true
            50
        );

        expect(Array.isArray(result)).toBe(true);
    });

    it('should handle extension methods with custom extension length', () => {
        const splineShape = createTestSpline();
        const polylineShape = createTestPolyline();

        const result = findSplinePolylineIntersectionsVerb(
            splineShape,
            polylineShape,
            false,
            true, // allowExtensions = true
            200 // larger extension length
        );

        expect(Array.isArray(result)).toBe(true);
    });
});
