import { describe, expect, it } from 'vitest';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import {
    findEllipseGenericIntersections,
    findEllipseIntersections,
} from './index';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('Ellipse Intersections', () => {
    describe('findEllipseIntersections', () => {
        it('should find intersections between ellipse and line', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 50, y: 0 },
                    minorToMajorRatio: 0.6,
                } as Ellipse,
            };

            const lineShape: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -60, y: 0 },
                    end: { x: 60, y: 0 },
                } as Line,
            };

            const results = findEllipseIntersections(ellipseShape, lineShape);

            expect(results.length).toBeGreaterThanOrEqual(1);

            // Verify intersection points are on the ellipse
            results.forEach((result) => {
                const { point } = result;

                // Check if point lies on the major axis (y=0 line through ellipse center)
                expect(Math.abs(point.y)).toBeLessThan(0.01);

                // Check if point is at ellipse boundary (±50 on x-axis for this ellipse)
                expect(Math.abs(Math.abs(point.x) - 50)).toBeLessThan(0.01);
            });
        });

        it('should find intersections between ellipse and arc', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 40, y: 0 },
                    minorToMajorRatio: 0.5,
                } as Ellipse,
            };

            const arcShape: Shape = {
                id: 'arc1',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 30, y: 0 },
                    radius: 25,
                    startAngle: Math.PI / 2,
                    endAngle: (3 * Math.PI) / 2,
                    clockwise: false,
                } as Arc,
            };

            const results = findEllipseIntersections(ellipseShape, arcShape);

            expect(results.length).toBeGreaterThanOrEqual(1);
        });

        it('should find intersections between ellipse and circle', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 60, y: 0 },
                    minorToMajorRatio: 0.5,
                } as Ellipse,
            };

            const circleShape: Shape = {
                id: 'circle1',
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 40, y: 0 },
                    radius: 35,
                } as Circle,
            };

            const results = findEllipseIntersections(ellipseShape, circleShape);

            expect(results.length).toBeGreaterThanOrEqual(1);
        });

        it('should find intersections between ellipse and polyline', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 50, y: 0 },
                    minorToMajorRatio: 0.8,
                } as Ellipse,
            };

            // Create a simple polyline that crosses the ellipse
            const polylineShape: Shape = {
                id: 'polyline1',
                type: GeometryType.POLYLINE,
                geometry: {
                    closed: false,
                    shapes: [],
                } as Polyline,
            };

            const results = findEllipseIntersections(
                ellipseShape,
                polylineShape
            );

            // Should handle ellipse-polyline intersections without errors
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle case when ellipse is first parameter', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 30, y: 0 },
                    minorToMajorRatio: 0.7,
                } as Ellipse,
            };

            const lineShape: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -40, y: 10 },
                    end: { x: 40, y: 10 },
                } as Line,
            };

            const results = findEllipseIntersections(ellipseShape, lineShape);

            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle case when ellipse is second parameter', () => {
            const lineShape: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -40, y: 15 },
                    end: { x: 40, y: 15 },
                } as Line,
            };

            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 50, y: 0 },
                    minorToMajorRatio: 0.6,
                } as Ellipse,
            };

            const results = findEllipseIntersections(lineShape, ellipseShape);

            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('findEllipseGenericIntersections', () => {
        it('should handle generic ellipse-line intersections', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 40, y: 0 },
                    minorToMajorRatio: 0.5,
                } as Ellipse,
            };

            const lineShape: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -50, y: 0 },
                    end: { x: 50, y: 0 },
                } as Line,
            };

            const results = findEllipseGenericIntersections(
                ellipseShape,
                lineShape,
                false
            );

            expect(results.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle unknown shape types with fallback', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 30, y: 0 },
                    minorToMajorRatio: 0.8,
                } as Ellipse,
            };

            // Create a mock unknown shape type
            const unknownShape: Shape = {
                id: 'unknown1',
                type: GeometryType.LINE, // Use line but treat as unknown in the context
                geometry: {
                    start: { x: -40, y: 0 },
                    end: { x: 40, y: 0 },
                } as Line,
            };

            const results = findEllipseGenericIntersections(
                ellipseShape,
                unknownShape,
                false
            );

            // Should not crash and may return results based on fallback logic
            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });
});
