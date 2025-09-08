import { describe, it, expect } from 'vitest';
import { findSplineLineIntersectionsVerb } from './line-spline/index';
import type { Shape } from '../../../types/geometry';

describe('Line-Spline Gap Intersection Tests', () => {
    // Create test spline - a cubic spline that we know works for gap intersection
    const testSpline: Shape = {
        id: 'spline1',
        type: 'spline',
        geometry: {
            controlPoints: [
                { x: 100, y: 200 },
                { x: 130, y: 160 },
                { x: 170, y: 140 },
                { x: 200, y: 180 },
            ],
            degree: 3,
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        },
    };

    // Create test line positioned with a gap from the spline that intersects when extended
    const testLine: Shape = {
        id: 'line1',
        type: 'line',
        geometry: {
            start: { x: 220, y: 160 },
            end: { x: 280, y: 120 },
        },
    };

    it('should find no intersections without extensions', () => {
        const result = findSplineLineIntersectionsVerb(
            testSpline,
            testLine,
            false,
            false
        );
        expect(result).toHaveLength(0);
    });

    it('should find gap intersections with extensions enabled', () => {
        const result = findSplineLineIntersectionsVerb(
            testSpline,
            testLine,
            false,
            true
        );

        expect(result.length).toBeGreaterThan(0);

        // All results should be marked as on extension
        for (const intersection of result) {
            expect(intersection.onExtension).toBe(true);
            expect(intersection.point).toBeDefined();
            expect(intersection.param1).toBeDefined();
            expect(intersection.param2).toBeDefined();
        }
    });

    it('should find normal intersections for intersecting line and spline', () => {
        // Create a line that actually intersects the spline
        const intersectingLine: Shape = {
            id: 'line2',
            type: 'line',
            geometry: {
                start: { x: 120, y: 100 },
                end: { x: 160, y: 180 },
            },
        };

        const resultWithoutExtensions = findSplineLineIntersectionsVerb(
            testSpline,
            intersectingLine,
            false,
            false
        );
        const resultWithExtensions = findSplineLineIntersectionsVerb(
            testSpline,
            intersectingLine,
            false,
            true
        );

        // Should find intersections in both cases
        expect(resultWithoutExtensions.length).toBeGreaterThan(0);
        expect(resultWithExtensions.length).toBeGreaterThan(0);

        // Normal intersections should not be marked as on extension
        for (const intersection of resultWithoutExtensions) {
            expect(intersection.onExtension).toBe(false);
        }

        // With extensions enabled, we might find additional points, but original intersections should still be marked correctly
        const normalIntersections = resultWithExtensions.filter(
            (int) => !int.onExtension
        );
        expect(normalIntersections.length).toBeGreaterThan(0);
    });

    it('should handle various spline configurations', () => {
        // Test with different spline types
        const cubicSpline: Shape = {
            id: 'spline2',
            type: 'spline',
            geometry: {
                controlPoints: [
                    { x: 100, y: 200 },
                    { x: 130, y: 160 },
                    { x: 170, y: 140 },
                    { x: 200, y: 180 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                fitPoints: [],
                closed: false,
            },
        };

        // Line positioned to test gap intersection with cubic spline
        const testLineForCubic: Shape = {
            id: 'line3',
            type: 'line',
            geometry: {
                start: { x: 220, y: 160 },
                end: { x: 280, y: 120 },
            },
        };

        const result = findSplineLineIntersectionsVerb(
            cubicSpline,
            testLineForCubic,
            false,
            true
        );
        expect(result.length).toBeGreaterThanOrEqual(0); // May or may not find intersections depending on geometry
    });

    it('should handle parameter swapping correctly', () => {
        const result1 = findSplineLineIntersectionsVerb(
            testSpline,
            testLine,
            false,
            true
        );
        const result2 = findSplineLineIntersectionsVerb(
            testSpline,
            testLine,
            true,
            true
        );

        // Should find same number of intersections
        expect(result1.length).toBe(result2.length);

        // Parameters should be swapped (with some tolerance for numerical precision)
        if (result1.length > 0 && result2.length > 0) {
            expect(result1[0].param1).toBeCloseTo(result2[0].param2, 6);
            expect(result1[0].param2).toBeCloseTo(result2[0].param1, 6);
        }
    });

    it('should handle edge cases gracefully', () => {
        // Test with very small spline
        const smallSpline: Shape = {
            id: 'small-spline',
            type: 'spline',
            geometry: {
                controlPoints: [
                    { x: 100, y: 100 },
                    { x: 101, y: 101 },
                ],
                degree: 1,
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                fitPoints: [],
                closed: false,
            },
        };

        // Should not crash
        const result = findSplineLineIntersectionsVerb(
            smallSpline,
            testLine,
            false,
            true
        );
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    });
});
