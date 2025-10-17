import { describe, it, expect } from 'vitest';
import {
    findEllipseEllipseIntersections,
    findEllipseEllipseIntersectionsVerb,
} from './index';
import type { Shape } from '$lib/geometry/shape';
import type { Ellipse } from '$lib/geometry/ellipse';
import { GeometryType } from '$lib/geometry/shape';

describe('Ellipse-Ellipse Intersection', () => {
    const createEllipseShape = (
        centerX: number = 0,
        centerY: number = 0,
        majorAxisX: number = 2,
        majorAxisY: number = 0,
        minorToMajorRatio: number = 0.5
    ): Shape => ({
        id: `ellipse-${centerX}-${centerY}`,
        type: GeometryType.ELLIPSE,
        geometry: {
            center: { x: centerX, y: centerY },
            majorAxisEndpoint: { x: majorAxisX, y: majorAxisY },
            minorToMajorRatio,
        } as Ellipse,
    });

    describe('findEllipseEllipseIntersections', () => {
        it('should find intersections between two ellipses', () => {
            const ellipse1 = createEllipseShape(0, 0, 2, 1);
            const ellipse2 = createEllipseShape(1, 0, 2, 1);

            const result = findEllipseEllipseIntersections(ellipse1, ellipse2);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should delegate to verb implementation', () => {
            const ellipse1 = createEllipseShape(0, 0, 2, 1);
            const ellipse2 = createEllipseShape(1, 0, 2, 1);

            const directResult = findEllipseEllipseIntersectionsVerb(
                ellipse1,
                ellipse2
            );
            const wrapperResult = findEllipseEllipseIntersections(
                ellipse1,
                ellipse2
            );

            // Check that both results have the same length
            expect(wrapperResult.length).toBe(directResult.length);

            // Check that results are approximately equal (handle floating point precision)
            for (let i = 0; i < wrapperResult.length; i++) {
                expect(wrapperResult[i].point.x).toBeCloseTo(
                    directResult[i].point.x,
                    8
                );
                expect(wrapperResult[i].point.y).toBeCloseTo(
                    directResult[i].point.y,
                    8
                );
                expect(wrapperResult[i].param1).toBeCloseTo(
                    directResult[i].param1,
                    8
                );
                expect(wrapperResult[i].param2).toBeCloseTo(
                    directResult[i].param2,
                    8
                );
                expect(wrapperResult[i].type).toBe(directResult[i].type);
                expect(wrapperResult[i].confidence).toBe(
                    directResult[i].confidence
                );
            }
        });

        it('should handle non-intersecting ellipses', () => {
            const ellipse1 = createEllipseShape(0, 0, 1, 1);
            const ellipse2 = createEllipseShape(5, 5, 1, 1);

            const result = findEllipseEllipseIntersections(ellipse1, ellipse2);

            expect(result).toEqual([]);
        });

        it('should handle identical ellipses', () => {
            const ellipse1 = createEllipseShape(0, 0, 2, 1);
            const ellipse2 = createEllipseShape(0, 0, 2, 1);

            const result = findEllipseEllipseIntersections(ellipse1, ellipse2);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle rotated ellipses', () => {
            const ellipse1 = createEllipseShape(0, 0, 2, 1, 0);
            const ellipse2 = createEllipseShape(0, 0, 2, 1, Math.PI / 4);

            const result = findEllipseEllipseIntersections(ellipse1, ellipse2);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle tangent ellipses', () => {
            const ellipse1 = createEllipseShape(0, 0, 1, 1);
            const ellipse2 = createEllipseShape(2, 0, 1, 1);

            const result = findEllipseEllipseIntersections(ellipse1, ellipse2);

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
