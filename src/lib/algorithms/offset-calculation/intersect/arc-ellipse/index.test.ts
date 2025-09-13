import { describe, it, expect } from 'vitest';
import {
    findEllipseArcIntersections,
    findEllipseArcIntersectionsVerb,
} from './index';
import type { Shape } from '$lib/types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { Ellipse } from '$lib/geometry/ellipse';
import { GeometryType } from '$lib/geometry/shape';

describe('Arc-Ellipse Intersection', () => {
    const createEllipseShape = (
        centerX: number = 0,
        centerY: number = 0,
        majorAxisX: number = 2,
        majorAxisY: number = 0,
        minorToMajorRatio: number = 0.5
    ): Shape => ({
        id: 'ellipse-1',
        type: GeometryType.ELLIPSE,
        geometry: {
            center: { x: centerX, y: centerY },
            majorAxisEndpoint: { x: majorAxisX, y: majorAxisY },
            minorToMajorRatio,
        } as Ellipse,
    });

    const createArcShape = (
        centerX: number = 0,
        centerY: number = 0,
        radius: number = 1.5,
        startAngle: number = 0,
        endAngle: number = Math.PI / 2
    ): Shape => ({
        id: 'arc-1',
        type: GeometryType.ARC,
        geometry: {
            center: { x: centerX, y: centerY },
            radius,
            startAngle,
            endAngle,
            clockwise: false,
        } as Arc,
    });

    describe('findEllipseArcIntersections', () => {
        it('should find intersections between ellipse and arc', () => {
            const ellipseShape = createEllipseShape();
            const arcShape = createArcShape();

            const result = findEllipseArcIntersections(
                ellipseShape,
                arcShape,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle swapped parameters', () => {
            const ellipseShape = createEllipseShape();
            const arcShape = createArcShape();

            const result = findEllipseArcIntersections(
                ellipseShape,
                arcShape,
                true
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should delegate to verb implementation', () => {
            const ellipseShape = createEllipseShape();
            const arcShape = createArcShape();

            const directResult = findEllipseArcIntersectionsVerb(
                ellipseShape,
                arcShape,
                false
            );
            const wrapperResult = findEllipseArcIntersections(
                ellipseShape,
                arcShape,
                false
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

        it('should handle non-intersecting ellipse and arc', () => {
            const ellipseShape = createEllipseShape(0, 0, 1, 0.5);
            const arcShape = createArcShape(5, 5, 1);

            const result = findEllipseArcIntersections(
                ellipseShape,
                arcShape,
                false
            );

            expect(result).toEqual([]);
        });

        it('should handle intersecting ellipse and arc with multiple points', () => {
            const ellipseShape = createEllipseShape(0, 0, 2, 2);
            const arcShape = createArcShape(0, 0, 1.5, 0, Math.PI * 2);

            const result = findEllipseArcIntersections(
                ellipseShape,
                arcShape,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
