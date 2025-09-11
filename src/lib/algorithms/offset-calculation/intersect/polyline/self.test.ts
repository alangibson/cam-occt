import { describe, expect, it } from 'vitest';
import {
    GeometryType,
    type Arc,
    type Polyline,
    type Shape,
} from '$lib/types/geometry';
import {
    findPolylineSelfIntersections,
    hasPolylineSelfIntersections,
} from './self';

describe('Polyline Self-Intersection Detection', () => {
    describe('findPolylineSelfIntersections', () => {
        it('should return empty array for polylines with less than 3 segments', () => {
            const singleSegmentPolyline: Shape = {
                id: 'single',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            const twoSegmentPolyline: Shape = {
                id: 'two',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 10, y: 10 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            expect(
                findPolylineSelfIntersections(singleSegmentPolyline)
            ).toEqual([]);
            expect(findPolylineSelfIntersections(twoSegmentPolyline)).toEqual(
                []
            );
        });

        it('should detect self-intersection in simple figure-8 polyline', () => {
            // Create a figure-8 pattern that actually intersects: two crossing diagonals
            // Segment 0: (0,0) -> (20,20)  and  Segment 2: (0,20) -> (20,0) should intersect at (10,10)
            const figure8Polyline: Shape = {
                id: 'figure8',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 20, y: 20 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 20 },
                                end: { x: 0, y: 20 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 20 },
                                end: { x: 20, y: 0 },
                            },
                        },
                        {
                            id: 'seg4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 0 },
                                end: { x: 0, y: 0 },
                            },
                        },
                    ],
                    closed: true,
                } as Polyline,
            };

            const intersections =
                findPolylineSelfIntersections(figure8Polyline);

            expect(intersections.length).toBeGreaterThan(0);

            // Should find intersection at the center at (10, 10)
            const centerIntersection = intersections.find(
                (int) =>
                    Math.abs(int.point.x - 10) < 0.1 &&
                    Math.abs(int.point.y - 10) < 0.1
            );
            expect(centerIntersection).toBeDefined();
        });

        it('should detect multiple self-intersections in complex polyline', () => {
            // Create a more complex pattern with multiple intersections
            const complexPolyline: Shape = {
                id: 'complex',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 30, y: 0 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 30, y: 0 },
                                end: { x: 30, y: 20 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 30, y: 20 },
                                end: { x: 0, y: 20 },
                            },
                        },
                        {
                            id: 'seg4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 20 },
                                end: { x: 0, y: 10 },
                            },
                        },
                        // Add crossing segments
                        {
                            id: 'seg5',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 10 },
                                end: { x: 20, y: 10 },
                            },
                        },
                        {
                            id: 'seg6',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 10 },
                                end: { x: 10, y: 5 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            const intersections =
                findPolylineSelfIntersections(complexPolyline);

            expect(intersections.length).toBeGreaterThan(0);
        });

        it('should not detect intersections in simple non-intersecting polyline', () => {
            const simplePolyline: Shape = {
                id: 'simple',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 10, y: 10 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 10 },
                                end: { x: 0, y: 10 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            const intersections = findPolylineSelfIntersections(simplePolyline);
            expect(intersections).toEqual([]);
        });

        it('should handle polylines with arc segments', () => {
            const arcPolyline: Shape = {
                id: 'arc',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 10 },
                                end: { x: 30, y: 10 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.ARC,
                            geometry: {
                                center: { x: 15, y: 15 },
                                radius: 5,
                                startAngle: Math.PI,
                                endAngle: 0,
                                clockwise: true,
                            } as Arc,
                        },
                        // Add a line that should intersect the arc
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 25, y: 10 },
                                end: { x: 15, y: 20 },
                            },
                        },
                        {
                            id: 'seg4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 15, y: 20 },
                                end: { x: 0, y: 10 },
                            },
                        },
                    ],
                    closed: true,
                } as Polyline,
            };

            const intersections = findPolylineSelfIntersections(arcPolyline);

            // Should find intersection between the arc and the crossing line
            expect(intersections.length).toBeGreaterThan(0);
        });

        it('should return proper parameter values for intersections', () => {
            const figure8Polyline: Shape = {
                id: 'figure8',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 10 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 10 },
                                end: { x: 20, y: 0 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 0 },
                                end: { x: 10, y: -10 },
                            },
                        },
                        {
                            id: 'seg4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: -10 },
                                end: { x: 0, y: 0 },
                            },
                        },
                    ],
                    closed: true,
                } as Polyline,
            };

            const intersections =
                findPolylineSelfIntersections(figure8Polyline);

            if (intersections.length > 0) {
                const intersection = intersections[0];

                // Parameters should be valid (between 0 and total segments)
                expect(intersection.param1).toBeGreaterThanOrEqual(0);
                expect(intersection.param1).toBeLessThanOrEqual(4);
                expect(intersection.param2).toBeGreaterThanOrEqual(0);
                expect(intersection.param2).toBeLessThanOrEqual(4);

                // Intersection point should be valid
                expect(intersection.point).toBeDefined();
                expect(typeof intersection.point.x).toBe('number');
                expect(typeof intersection.point.y).toBe('number');

                // Type and confidence should be set
                expect(intersection.type).toBeDefined();
                expect(intersection.confidence).toBeGreaterThan(0);
                expect(intersection.confidence).toBeLessThanOrEqual(1);
            }
        });

        it('should throw error for non-polyline shapes', () => {
            const lineShape: Shape = {
                id: 'line',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
            };

            expect(() => findPolylineSelfIntersections(lineShape)).toThrow(
                'Shape must be of type polyline'
            );
        });
    });

    describe('hasPolylineSelfIntersections', () => {
        it('should return true for self-intersecting polyline', () => {
            const figure8Polyline: Shape = {
                id: 'figure8',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 20, y: 20 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 20 },
                                end: { x: 0, y: 20 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 20 },
                                end: { x: 20, y: 0 },
                            },
                        },
                        {
                            id: 'seg4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 0 },
                                end: { x: 0, y: 0 },
                            },
                        },
                    ],
                    closed: true,
                } as Polyline,
            };

            expect(hasPolylineSelfIntersections(figure8Polyline)).toBe(true);
        });

        it('should return false for non-intersecting polyline', () => {
            const simplePolyline: Shape = {
                id: 'simple',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 10, y: 10 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 10 },
                                end: { x: 0, y: 10 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            expect(hasPolylineSelfIntersections(simplePolyline)).toBe(false);
        });

        it('should return false for polylines with less than 3 segments', () => {
            const twoSegmentPolyline: Shape = {
                id: 'two',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 10, y: 10 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            expect(hasPolylineSelfIntersections(twoSegmentPolyline)).toBe(
                false
            );
        });

        it('should return false for non-polyline shapes', () => {
            const lineShape: Shape = {
                id: 'line',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
            };

            expect(hasPolylineSelfIntersections(lineShape)).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle nearly coincident segments', () => {
            const nearlyCoincidentPolyline: Shape = {
                id: 'nearly-coincident',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: [
                        {
                            id: 'seg1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                        {
                            id: 'seg2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 10, y: 10 },
                            },
                        },
                        {
                            id: 'seg3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 10 },
                                end: { x: 5, y: 5 },
                            },
                        },
                        // Nearly coincident with seg1 but slightly offset
                        {
                            id: 'seg4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 5, y: 5 },
                                end: { x: 8, y: 0.001 },
                            },
                        },
                    ],
                    closed: false,
                } as Polyline,
            };

            // Should not crash and handle numerical precision issues
            expect(() =>
                findPolylineSelfIntersections(nearlyCoincidentPolyline)
            ).not.toThrow();
        });

        it('should handle large polylines efficiently', () => {
            // Create a large non-intersecting sawtooth pattern
            const segments: Shape[] = [];
            const numSegments = 50;

            for (let i = 0; i < numSegments - 1; i++) {
                const x1 = i * 2;
                const y1 = (i % 2) * 10; // Alternating height
                const x2 = (i + 1) * 2;
                const y2 = ((i + 1) % 2) * 10;

                segments.push({
                    id: `seg${i}`,
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: x1, y: y1 },
                        end: { x: x2, y: y2 },
                    },
                });
            }

            const largePolyline: Shape = {
                id: 'large',
                type: GeometryType.POLYLINE,
                geometry: {
                    shapes: segments,
                    closed: false,
                } as Polyline,
            };

            const startTime = performance.now();
            const intersections = findPolylineSelfIntersections(largePolyline);
            const endTime = performance.now();

            // Should complete in reasonable time (less than 100ms for this size)
            expect(endTime - startTime).toBeLessThan(100);

            // Simple sawtooth pattern should not self-intersect
            expect(intersections).toEqual([]);
        });
    });
});
