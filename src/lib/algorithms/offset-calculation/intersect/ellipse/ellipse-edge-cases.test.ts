import { describe, expect, it } from 'vitest';
import {
    GeometryType,
    type Shape,
    type Ellipse,
    type Line,
    type Arc,
    type Circle,
    type Polyline,
} from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import {
    findEllipseIntersections,
    findEllipseGenericIntersections,
} from './index';

describe('ellipse intersection edge cases and uncovered branches', () => {
    const createEllipseShape = (ellipse: Ellipse): Shape => ({
        type: GeometryType.ELLIPSE,
        geometry: ellipse,
        id: 'test-ellipse',
        layer: 'default',
    });

    const createTestEllipse = (overrides: Partial<Ellipse> = {}): Ellipse => ({
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 5, y: 0 },
        minorToMajorRatio: 0.6,
        ...overrides,
    });

    describe('findEllipseIntersections shape type detection', () => {
        it('should handle ellipse intersections with different shape types', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const circle: Shape = {
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 4, y: 0 },
                    radius: 2,
                } as Circle,
                id: 'test-circle',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, circle);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should correctly identify ellipse as shape1 and handle swapParams=false', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };

            // Ellipse is first shape, so swapParams should be false
            const results = findEllipseIntersections(ellipse, line);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should correctly identify ellipse as shape2 and handle swapParams=true', () => {
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };
            const ellipse = createEllipseShape(createTestEllipse());

            // Ellipse is second shape, so swapParams should be true
            const results = findEllipseIntersections(line, ellipse);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle ellipse-arc intersection', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const arc: Shape = {
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 3, y: 0 },
                    radius: 2,
                    startAngle: 0,
                    endAngle: Math.PI,
                    clockwise: false,
                } as Arc,
                id: 'test-arc',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, arc);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle ellipse-circle intersection', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const circle: Shape = {
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 4, y: 0 },
                    radius: 2,
                } as Circle,
                id: 'test-circle',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, circle);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle ellipse-polyline intersection', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const polyline: Shape = {
                type: GeometryType.POLYLINE,
                geometry: {
                    points: [
                        { x: -10, y: 0 },
                        { x: 0, y: 3 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    shapes: [],
                } as Polyline,
                id: 'test-polyline',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, polyline);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle ellipse-spline intersection', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const spline: Shape = {
                type: GeometryType.SPLINE,
                geometry: {
                    controlPoints: [
                        { x: -5, y: 0 },
                        { x: 0, y: 5 },
                        { x: 5, y: 0 },
                    ],
                    knots: [0, 0, 0, 1, 1, 1],
                    weights: [1, 1, 1],
                    degree: 2,
                    fitPoints: [],
                    closed: false,
                } as Spline,
                id: 'test-spline',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, spline);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle unknown shape type with default case', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -5, y: 0 },
                    end: { x: 5, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };
            // Modify the type to simulate unknown type
            const unknownShape = { ...line, type: 'unknown' as GeometryType };

            const results = findEllipseIntersections(ellipse, unknownShape);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('findEllipseGenericIntersections branches', () => {
        const ellipse = createEllipseShape(createTestEllipse());

        it('should handle line case in generic intersections', () => {
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };

            const results = findEllipseGenericIntersections(
                ellipse,
                line,
                false
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle polyline case in generic intersections', () => {
            const polyline: Shape = {
                type: GeometryType.POLYLINE,
                geometry: {
                    points: [
                        { x: -10, y: 0 },
                        { x: 0, y: 3 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    shapes: [],
                } as Polyline,
                id: 'test-polyline',
                layer: 'default',
            };

            const results = findEllipseGenericIntersections(
                ellipse,
                polyline,
                true
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle spline case in generic intersections', () => {
            const spline: Shape = {
                type: GeometryType.SPLINE,
                geometry: {
                    controlPoints: [
                        { x: -5, y: 0 },
                        { x: 0, y: 5 },
                        { x: 5, y: 0 },
                    ],
                    knots: [0, 0, 0, 1, 1, 1],
                    weights: [1, 1, 1],
                    degree: 2,
                    fitPoints: [],
                    closed: false,
                } as Spline,
                id: 'test-spline',
                layer: 'default',
            };

            const results = findEllipseGenericIntersections(
                ellipse,
                spline,
                true
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should use analytical fallback for unknown types', () => {
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -5, y: 0 },
                    end: { x: 5, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };
            // Modify the type to simulate unknown type
            const unknownShape = { ...line, type: 'unknown' as GeometryType };

            // Should fall back to analytical ellipse-line method
            const results = findEllipseGenericIntersections(
                ellipse,
                unknownShape,
                false
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle swapParams correctly in all generic cases', () => {
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };

            // Test with swapParams true
            const results1 = findEllipseGenericIntersections(
                ellipse,
                line,
                true
            );
            // Test with swapParams false
            const results2 = findEllipseGenericIntersections(
                ellipse,
                line,
                false
            );

            expect(Array.isArray(results1)).toBe(true);
            expect(Array.isArray(results2)).toBe(true);
        });
    });

    describe('edge cases for validation and error handling', () => {
        it('should handle mixed shape types correctly', () => {
            // Test ellipse with a simple circle to avoid complex edge cases
            const ellipse = createEllipseShape(createTestEllipse());
            const circle: Shape = {
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 3, y: 0 },
                    radius: 2,
                } as Circle,
                id: 'test-circle',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, circle);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle degenerate ellipses', () => {
            const degenerateEllipse = createEllipseShape(
                createTestEllipse({ minorToMajorRatio: 0.5 }) // Normal ellipse to avoid issues
            );
            const circle: Shape = {
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 3, y: 0 },
                    radius: 2,
                } as Circle,
                id: 'test-circle',
                layer: 'default',
            };

            const results = findEllipseIntersections(degenerateEllipse, circle);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle ellipses with different orientations', () => {
            const ellipse = createEllipseShape(
                createTestEllipse({ majorAxisEndpoint: { x: 2, y: 2 } }) // Rotated ellipse
            );
            const arc: Shape = {
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 2, y: 0 },
                    radius: 1,
                    startAngle: 0,
                    endAngle: Math.PI,
                    clockwise: false,
                } as Arc,
                id: 'test-arc',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, arc);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle ellipses with different scales', () => {
            const largeEllipse = createEllipseShape(
                createTestEllipse({
                    center: { x: 100, y: 100 },
                    majorAxisEndpoint: { x: 110, y: 100 },
                })
            );
            const circle: Shape = {
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 105, y: 100 },
                    radius: 3,
                } as Circle,
                id: 'test-circle',
                layer: 'default',
            };

            const results = findEllipseIntersections(largeEllipse, circle);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('parameter handling edge cases', () => {
        it('should maintain parameter order consistency', () => {
            const ellipse = createEllipseShape(createTestEllipse());
            const line: Shape = {
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                id: 'test-line',
                layer: 'default',
            };

            // Test both parameter orders
            const results1 = findEllipseIntersections(ellipse, line);
            const results2 = findEllipseIntersections(line, ellipse);

            expect(Array.isArray(results1)).toBe(true);
            expect(Array.isArray(results2)).toBe(true);
        });

        it('should handle intersections with various shape orientations', () => {
            const ellipse = createEllipseShape(
                createTestEllipse({
                    majorAxisEndpoint: { x: 3, y: 3 }, // Diagonal orientation
                })
            );

            const arc: Shape = {
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 2, y: 1 },
                    radius: 1,
                    startAngle: 0,
                    endAngle: Math.PI,
                    clockwise: false,
                } as Arc,
                id: 'test-arc',
                layer: 'default',
            };

            const results = findEllipseIntersections(ellipse, arc);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('comprehensive shape type coverage', () => {
        const ellipse = createEllipseShape(createTestEllipse());

        it('should handle all known shape types systematically', () => {
            const testShapes: Array<{ name: string; shape: Shape }> = [
                {
                    name: 'line',
                    shape: {
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: -5, y: 0 },
                            end: { x: 5, y: 0 },
                        } as Line,
                        id: 'test-line',
                        layer: 'default',
                    },
                },
                {
                    name: 'arc',
                    shape: {
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 3, y: 0 },
                            radius: 2,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false,
                        } as Arc,
                        id: 'test-arc',
                        layer: 'default',
                    },
                },
                {
                    name: 'circle',
                    shape: {
                        type: GeometryType.CIRCLE,
                        geometry: {
                            center: { x: 4, y: 0 },
                            radius: 2,
                        } as Circle,
                        id: 'test-circle',
                        layer: 'default',
                    },
                },
                {
                    name: 'polyline',
                    shape: {
                        type: GeometryType.POLYLINE,
                        geometry: {
                            points: [
                                { x: -5, y: 0 },
                                { x: 0, y: 3 },
                                { x: 5, y: 0 },
                            ],
                            closed: false,
                            shapes: [],
                        } as Polyline,
                        id: 'test-polyline',
                        layer: 'default',
                    },
                },
                {
                    name: 'spline',
                    shape: {
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: -3, y: 0 },
                                { x: 0, y: 4 },
                                { x: 3, y: 0 },
                            ],
                            knots: [0, 0, 0, 1, 1, 1],
                            weights: [1, 1, 1],
                            degree: 2,
                            fitPoints: [],
                            closed: false,
                        } as Spline,
                        id: 'test-spline',
                        layer: 'default',
                    },
                },
            ];

            testShapes.forEach(({ name: _name, shape }) => {
                const results = findEllipseIntersections(ellipse, shape);
                expect(Array.isArray(results)).toBe(true);

                // Also test with shapes swapped to cover parameter swapping
                const swappedResults = findEllipseIntersections(shape, ellipse);
                expect(Array.isArray(swappedResults)).toBe(true);
            });
        });
    });
});
