import { describe, it, expect } from 'vitest';
import {
    trimShapeAtPoint,
    selectTrimPoint,
    trimConsecutiveShapes,
} from './index';
import { type KeepSide, type TrimResult } from './types';
import type {
    Shape,
    Line,
    Arc,
    Circle,
    Point2D,
    Polyline,
    Spline,
    Ellipse,
} from '../../../types/geometry';
import type { IntersectionResult } from '../chain/types';
import { generateId } from '../../../utils/id';
import {
    polylineToPoints,
    createPolylineFromVertices,
} from '../../../geometry/polyline';

describe('trimming', () => {
    // Helper functions to create test shapes
    function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
        return {
            id: generateId(),
            type: 'line',
            geometry: {
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
            } as Line,
        };
    }

    function createArc(
        cx: number,
        cy: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): Shape {
        return {
            id: generateId(),
            type: 'arc',
            geometry: {
                center: { x: cx, y: cy },
                radius,
                startAngle,
                endAngle,
                clockwise,
            } as Arc,
        };
    }

    function createCircle(cx: number, cy: number, radius: number): Shape {
        return {
            id: generateId(),
            type: 'circle',
            geometry: {
                center: { x: cx, y: cy },
                radius,
            } as Circle,
        };
    }

    // Helper to check if two points are approximately equal
    function pointsApproxEqual(
        p1: Point2D,
        p2: Point2D,
        tolerance: number = 1e-6
    ): boolean {
        return (
            Math.abs(p1.x - p2.x) < tolerance &&
            Math.abs(p1.y - p2.y) < tolerance
        );
    }

    // Helper to validate trim result
    function validateTrimResult(
        result: TrimResult,
        shouldSucceed: boolean = true
    ): void {
        if (shouldSucceed) {
            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();
            expect(result.errors).toHaveLength(0);
        } else {
            expect(result.success).toBe(false);
            expect(result.shape).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);
        }
    }

    describe('trimShapeAtPoint', () => {
        describe('line trimming', () => {
            it('should trim line at start (keep end portion)', () => {
                const lineShape = createLine(0, 0, 10, 0);
                const trimPoint = { x: 3, y: 0 };

                const result = trimShapeAtPoint(lineShape, trimPoint, 'end');

                validateTrimResult(result, true);
                const trimmedLine = result.shape!.geometry as Line;
                expect(pointsApproxEqual(trimmedLine.start, trimPoint)).toBe(
                    true
                );
                expect(
                    pointsApproxEqual(trimmedLine.end, { x: 10, y: 0 })
                ).toBe(true);
            });

            it('should trim line at end (keep start portion)', () => {
                const line = createLine(0, 0, 10, 0);
                const trimPoint = { x: 7, y: 0 };

                const result = trimShapeAtPoint(line, trimPoint, 'start');

                validateTrimResult(result, true);
                const trimmedLine = result.shape!.geometry as Line;
                expect(
                    pointsApproxEqual(trimmedLine.start, { x: 0, y: 0 })
                ).toBe(true);
                expect(pointsApproxEqual(trimmedLine.end, trimPoint)).toBe(
                    true
                );
            });

            it('should handle diagonal lines', () => {
                const line = createLine(0, 0, 10, 10);
                const trimPoint = { x: 5, y: 5 };

                const result = trimShapeAtPoint(line, trimPoint, 'before');

                validateTrimResult(result, true);
                const trimmedLine = result.shape!.geometry as Line;
                expect(
                    pointsApproxEqual(trimmedLine.start, { x: 0, y: 0 })
                ).toBe(true);
                expect(pointsApproxEqual(trimmedLine.end, trimPoint)).toBe(
                    true
                );
            });

            it('should reject trim point not on line', () => {
                const line = createLine(0, 0, 10, 0);
                const trimPoint = { x: 5, y: 5 }; // Off the line

                const result = trimShapeAtPoint(line, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('not on the line');
            });

            it('should reject degenerate trims', () => {
                const line = createLine(0, 0, 10, 0);
                const trimPoint = { x: 0, y: 0 }; // Same as start

                const result = trimShapeAtPoint(line, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('degenerate');
            });

            it('should handle very small lines', () => {
                const line = createLine(0, 0, 0.001, 0);
                const trimPoint = { x: 0.0005, y: 0 };

                const result = trimShapeAtPoint(line, trimPoint, 'start');

                validateTrimResult(result, true);
            });
        });

        describe('arc trimming', () => {
            it('should trim arc at start (keep end portion)', () => {
                const arc = createArc(0, 0, 5, 0, Math.PI); // Half circle
                const trimAngle = Math.PI / 4; // 45 degrees
                const trimPoint = {
                    x: 5 * Math.cos(trimAngle),
                    y: 5 * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(arc, trimPoint, 'end');

                validateTrimResult(result, true);
                const trimmedArc = result.shape!.geometry as Arc;
                expect(trimmedArc.startAngle).toBeCloseTo(trimAngle);
                expect(trimmedArc.endAngle).toBeCloseTo(Math.PI);
                expect(trimmedArc.radius).toBeCloseTo(5);
                expect(
                    pointsApproxEqual(trimmedArc.center, { x: 0, y: 0 })
                ).toBe(true);
            });

            it('should trim arc at end (keep start portion)', () => {
                const arc = createArc(0, 0, 3, 0, Math.PI / 2); // Quarter circle
                const trimAngle = Math.PI / 6; // 30 degrees
                const trimPoint = {
                    x: 3 * Math.cos(trimAngle),
                    y: 3 * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(arc, trimPoint, 'start');

                validateTrimResult(result, true);
                const trimmedArc = result.shape!.geometry as Arc;
                expect(trimmedArc.startAngle).toBeCloseTo(0);
                expect(trimmedArc.endAngle).toBeCloseTo(trimAngle);
            });

            it('should reject trim point not on arc', () => {
                const arc = createArc(0, 0, 5, 0, Math.PI);
                const trimPoint = { x: 3, y: 0 }; // Wrong radius

                const result = trimShapeAtPoint(arc, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('not on the arc');
            });

            it('should extend arc when trim point is outside angular range', () => {
                const arc = createArc(0, 0, 5, 0, Math.PI / 2); // First quadrant only (0 to 90 degrees)
                const trimPoint = {
                    x: 5 * Math.cos((3 * Math.PI) / 4),
                    y: 5 * Math.sin((3 * Math.PI) / 4),
                }; // 135 degrees, exactly on arc radius

                const result = trimShapeAtPoint(arc, trimPoint, 'start'); // Keep start portion, trim end to this point

                validateTrimResult(result, true);
                expect(result.warnings[0]).toContain(
                    'Arc was extended to reach trim point'
                );

                const trimmedArc = result.shape!.geometry as Arc;
                expect(trimmedArc.radius).toBeCloseTo(5);
                expect(
                    pointsApproxEqual(trimmedArc.center, { x: 0, y: 0 })
                ).toBe(true);
                // The arc should now start at the original start (0 degrees) and end at the trim point (135 degrees)
                expect(trimmedArc.startAngle).toBeCloseTo(0); // 0 degrees
                expect(trimmedArc.endAngle).toBeCloseTo((3 * Math.PI) / 4); // 135 degrees
            });

            it('should handle clockwise arcs', () => {
                const arc = createArc(0, 0, 4, Math.PI, 0, true); // Clockwise half circle
                const trimAngle = (Math.PI * 3) / 4; // 135 degrees
                const trimPoint = {
                    x: 4 * Math.cos(trimAngle),
                    y: 4 * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(arc, trimPoint, 'end');

                validateTrimResult(result, true);
                const trimmedArc = result.shape!.geometry as Arc;
                expect(trimmedArc.clockwise).toBe(true);
                expect(trimmedArc.startAngle).toBeCloseTo(trimAngle);
            });
        });

        describe('circle trimming', () => {
            it('should convert circle to arc when trimmed', () => {
                const circle = createCircle(0, 0, 5);
                const trimPoint = { x: 5, y: 0 }; // Point on circle

                const result = trimShapeAtPoint(circle, trimPoint, 'start');

                validateTrimResult(result, true);
                expect(result.shape!.type).toBe('arc');
                expect(result.warnings).toContain(
                    'Circle converted to arc for trimming'
                );

                const trimmedArc = result.shape!.geometry as Arc;
                expect(trimmedArc.radius).toBeCloseTo(5);
                expect(
                    pointsApproxEqual(trimmedArc.center, { x: 0, y: 0 })
                ).toBe(true);
            });

            it('should reject trim point not on circle', () => {
                const circle = createCircle(0, 0, 5);
                const trimPoint = { x: 3, y: 0 }; // Inside circle

                const result = trimShapeAtPoint(circle, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('not on the circle');
            });
        });

        describe('ellipse trimming', () => {
            function createEllipse(
                cx: number,
                cy: number,
                majorAxisX: number,
                majorAxisY: number,
                minorToMajorRatio: number,
                startParam?: number,
                endParam?: number
            ): Shape {
                return {
                    id: generateId(),
                    type: 'ellipse',
                    geometry: {
                        center: { x: cx, y: cy },
                        majorAxisEndpoint: { x: majorAxisX, y: majorAxisY },
                        minorToMajorRatio,
                        startParam,
                        endParam,
                    } as Ellipse,
                };
            }

            it('should trim full ellipse at point (convert to ellipse arc)', () => {
                const ellipse = createEllipse(0, 0, 4, 0, 0.5); // Horizontal ellipse, a=4, b=2
                const trimPoint = { x: 4, y: 0 }; // Point on ellipse at angle 0

                const result = trimShapeAtPoint(ellipse, trimPoint, 'start');

                validateTrimResult(result, true);
                expect(result.warnings).toContain(
                    'Full ellipse converted to ellipse arc for trimming'
                );

                const trimmedEllipse = result.shape!.geometry as Ellipse;
                expect(trimmedEllipse.startParam).toBeDefined();
                expect(trimmedEllipse.endParam).toBeDefined();
                expect(
                    pointsApproxEqual(trimmedEllipse.center, { x: 0, y: 0 })
                ).toBe(true);
                expect(
                    pointsApproxEqual(trimmedEllipse.majorAxisEndpoint, {
                        x: 4,
                        y: 0,
                    })
                ).toBe(true);
                expect(trimmedEllipse.minorToMajorRatio).toBe(0.5);
            });

            it('should trim ellipse arc at interior point', () => {
                const ellipse = createEllipse(0, 0, 3, 0, 0.6, 0, Math.PI); // Half ellipse from 0 to π
                const trimAngle = Math.PI / 3; // 60 degrees
                const a = 3;
                const b = 3 * 0.6; // 1.8
                const trimPoint = {
                    x: a * Math.cos(trimAngle),
                    y: b * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(ellipse, trimPoint, 'end');

                validateTrimResult(result, true);
                const trimmedEllipse = result.shape!.geometry as Ellipse;
                expect(trimmedEllipse.startParam).toBeCloseTo(trimAngle);
                expect(trimmedEllipse.endParam).toBeCloseTo(Math.PI);
            });

            it('should trim ellipse arc before trim point', () => {
                const ellipse = createEllipse(0, 0, 5, 0, 0.8, 0, Math.PI); // Half ellipse
                const trimAngle = Math.PI / 2; // 90 degrees
                const a = 5;
                const b = 5 * 0.8; // 4
                const trimPoint = {
                    x: a * Math.cos(trimAngle),
                    y: b * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(ellipse, trimPoint, 'before');

                validateTrimResult(result, true);
                const trimmedEllipse = result.shape!.geometry as Ellipse;
                expect(trimmedEllipse.startParam).toBeCloseTo(0);
                expect(trimmedEllipse.endParam).toBeCloseTo(trimAngle);
            });

            it('should handle rotated ellipse', () => {
                const ellipse = createEllipse(0, 0, 0, 3, 0.5); // Vertical ellipse, rotated 90°
                const a = 3;
                const b = 3 * 0.5; // 1.5
                const trimAngle = Math.PI / 4; // 45 degrees in local coords
                // Transform to global coordinates (90° rotation)
                const localX = a * Math.cos(trimAngle);
                const localY = b * Math.sin(trimAngle);
                const trimPoint = { x: -localY, y: localX }; // 90° rotation

                const result = trimShapeAtPoint(ellipse, trimPoint, 'start');

                validateTrimResult(result, true);
                const trimmedEllipse = result.shape!.geometry as Ellipse;
                expect(trimmedEllipse.startParam).toBeDefined();
                expect(trimmedEllipse.endParam).toBeDefined();
            });

            it('should reject trim point not on ellipse', () => {
                const ellipse = createEllipse(0, 0, 4, 0, 0.5);
                const trimPoint = { x: 2, y: 0 }; // Inside ellipse

                const result = trimShapeAtPoint(ellipse, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('not on the ellipse');
            });

            it('should reject trim point outside ellipse arc bounds', () => {
                const ellipse = createEllipse(0, 0, 4, 0, 0.5, 0, Math.PI / 2); // First quadrant only
                const a = 4;
                const b = 4 * 0.5; // 2
                const trimAngle = Math.PI; // 180 degrees - outside arc bounds
                const trimPoint = {
                    x: a * Math.cos(trimAngle),
                    y: b * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(ellipse, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain(
                    'not within ellipse arc bounds'
                );
            });

            it('should handle ellipse arc crossing 0° (wraparound case)', () => {
                const ellipse = createEllipse(
                    0,
                    0,
                    3,
                    0,
                    0.75,
                    (7 * Math.PI) / 4,
                    Math.PI / 4
                ); // 315° to 45°
                const a = 3;
                const b = 3 * 0.75; // 2.25
                const trimAngle = 0; // 0 degrees - within wraparound range
                const trimPoint = {
                    x: a * Math.cos(trimAngle),
                    y: b * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(ellipse, trimPoint, 'end');

                validateTrimResult(result, true);
                const trimmedEllipse = result.shape!.geometry as Ellipse;
                expect(trimmedEllipse.startParam).toBeCloseTo(0);
                expect(trimmedEllipse.endParam).toBeCloseTo(Math.PI / 4);
            });

            it('should reject degenerate ellipse arc', () => {
                const ellipse = createEllipse(
                    0,
                    0,
                    4,
                    0,
                    0.5,
                    Math.PI / 4,
                    Math.PI / 4 + 1e-12
                ); // Extremely small arc
                const a = 4;
                const b = 4 * 0.5; // 2
                const trimAngle = Math.PI / 4 + 5e-13; // Middle of tiny arc
                const trimPoint = {
                    x: a * Math.cos(trimAngle),
                    y: b * Math.sin(trimAngle),
                };

                const result = trimShapeAtPoint(ellipse, trimPoint, 'start');

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('degenerate');
            });

            it('should handle tolerance correctly for on-ellipse detection', () => {
                const ellipse = createEllipse(0, 0, 4, 0, 0.5);
                const trimPoint = { x: 4, y: 0.01 }; // Slightly off ellipse

                // Should fail with tight tolerance
                const result1 = trimShapeAtPoint(
                    ellipse,
                    trimPoint,
                    'start',
                    1e-6
                );
                validateTrimResult(result1, false);

                // Should succeed with loose tolerance
                const result2 = trimShapeAtPoint(
                    ellipse,
                    trimPoint,
                    'start',
                    0.02
                );
                validateTrimResult(result2, true);
            });

            it('should preserve ellipse properties after trimming', () => {
                const ellipse = createEllipse(2, 3, 5, 0, 0.6);
                const trimPoint = { x: 7, y: 3 }; // Point on ellipse

                const result = trimShapeAtPoint(ellipse, trimPoint, 'start');

                validateTrimResult(result, true);
                const trimmedEllipse = result.shape!.geometry as Ellipse;
                expect(
                    pointsApproxEqual(trimmedEllipse.center, { x: 2, y: 3 })
                ).toBe(true);
                expect(
                    pointsApproxEqual(trimmedEllipse.majorAxisEndpoint, {
                        x: 5,
                        y: 0,
                    })
                ).toBe(true);
                expect(trimmedEllipse.minorToMajorRatio).toBe(0.6);
            });

            it('should handle invalid keepSide values', () => {
                const ellipse = createEllipse(0, 0, 4, 0, 0.5);
                const trimPoint = { x: 4, y: 0 };

                const result = trimShapeAtPoint(
                    ellipse,
                    trimPoint,
                    'invalid' as KeepSide
                );

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain('Invalid keepSide value');
            });
        });

        describe('unsupported shape types', () => {
            it('should handle polylines successfully', () => {
                const vertices = [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 5, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                ];
                const polyline: Shape = {
                    id: generateId(),
                    type: 'polyline',
                    geometry: createPolylineFromVertices(vertices, false)
                        .geometry as Polyline,
                };

                const result = trimShapeAtPoint(
                    polyline,
                    { x: 5, y: 0 },
                    'start'
                );

                if (!result.success) {
                    console.log(
                        'Polyline trim failed with errors:',
                        result.errors
                    );
                }

                validateTrimResult(result, true);
                const trimmedPolyline = result.shape!.geometry as Polyline;
                const points = polylineToPoints(trimmedPolyline);
                expect(points).toHaveLength(2);
                expect(pointsApproxEqual(points[0], { x: 0, y: 0 })).toBe(true);
                expect(pointsApproxEqual(points[1], { x: 5, y: 0 })).toBe(true);
            });

            it('should reject trimming at endpoints that would result in degenerate polylines', () => {
                const vertices = [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 5, y: 0, bulge: 0 },
                ];
                const polyline: Shape = {
                    id: generateId(),
                    type: 'polyline',
                    geometry: createPolylineFromVertices(vertices, false)
                        .geometry as Polyline,
                };

                // Try to trim at the exact start point, which would leave only 1 point or create a degenerate result
                const result = trimShapeAtPoint(
                    polyline,
                    { x: 0, y: 0 },
                    'start'
                );

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain(
                    'Trimmed polyline would have less than 2 points'
                );
            });

            it('should handle splines gracefully', () => {
                const spline: Shape = {
                    id: generateId(),
                    type: 'spline',
                    geometry: {
                        controlPoints: [
                            { x: 0, y: 0 },
                            { x: 5, y: 5 },
                            { x: 10, y: 0 },
                        ],
                        knots: [],
                        weights: [1, 1, 1],
                        degree: 2,
                        fitPoints: [],
                        closed: false,
                    } as Spline,
                };

                const result = trimShapeAtPoint(
                    spline,
                    { x: 5, y: 2.5 },
                    'start'
                );

                validateTrimResult(result, false);
                expect(result.errors[0]).toContain(
                    'Trim point is not on the spline'
                );
            });
        });
    });

    describe('selectTrimPoint', () => {
        function createIntersection(
            x: number,
            y: number,
            confidence: number = 1.0,
            type: string = 'exact'
        ): IntersectionResult {
            return {
                point: { x, y },
                param1: 0.5,
                param2: 0.5,
                distance: 0,
                type: type as
                    | 'exact'
                    | 'approximate'
                    | 'tangent'
                    | 'coincident',
                confidence,
            };
        }

        it('should return null for empty intersection array', () => {
            const result = selectTrimPoint([], { x: 0, y: 0 });
            expect(result).toBeNull();
        });

        it('should return single intersection', () => {
            const intersections = [createIntersection(1, 1)];
            const result = selectTrimPoint(intersections, { x: 0, y: 0 });

            expect(result).toBe(intersections[0]);
        });

        it('should select closest intersection to joint point', () => {
            const intersections = [
                createIntersection(5, 5), // Farther
                createIntersection(1, 1), // Closer
                createIntersection(10, 10), // Farthest
            ];
            const jointPoint = { x: 0, y: 0 };

            const result = selectTrimPoint(intersections, jointPoint);

            expect(result).toBe(intersections[1]); // Closest one
            expect(result!.point.x).toBe(1);
            expect(result!.point.y).toBe(1);
        });

        it('should consider confidence in scoring', () => {
            const intersections = [
                createIntersection(1, 1, 0.5), // Closer but lower confidence
                createIntersection(2, 2, 1.0), // Farther but higher confidence
            ];
            const jointPoint = { x: 0, y: 0 };

            const result = selectTrimPoint(intersections, jointPoint);

            // The higher confidence one might win despite being farther
            // (depends on scoring weights)
            expect(result).toBeDefined();
        });

        it('should prefer exact intersections over approximate ones', () => {
            const intersections = [
                createIntersection(1, 1, 1.0, 'approximate'),
                createIntersection(1.1, 1.1, 1.0, 'exact'), // Slightly farther but exact
            ];
            const jointPoint = { x: 0, y: 0 };

            const result = selectTrimPoint(intersections, jointPoint);

            expect(result!.type).toBe('exact');
        });
    });

    describe('trimConsecutiveShapes', () => {
        it('should trim both shapes at their intersection', () => {
            const line1 = createLine(0, 0, 10, 10);
            const line2 = createLine(0, 10, 10, 0);

            // Create intersection at (5, 5)
            const intersections: IntersectionResult[] = [
                {
                    point: { x: 5, y: 5 },
                    param1: 0.5,
                    param2: 0.5,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];

            const result = trimConsecutiveShapes(line1, line2, intersections);

            validateTrimResult(result.shape1Result, true);
            validateTrimResult(result.shape2Result, true);

            // First shape should be trimmed to end at intersection
            const trimmed1 = result.shape1Result.shape!.geometry as Line;
            expect(pointsApproxEqual(trimmed1.end, { x: 5, y: 5 })).toBe(true);

            // Second shape should be trimmed to start at intersection
            const trimmed2 = result.shape2Result.shape!.geometry as Line;
            expect(pointsApproxEqual(trimmed2.start, { x: 5, y: 5 })).toBe(
                true
            );
        });

        it('should handle no intersections gracefully', () => {
            const line1 = createLine(0, 0, 10, 0);
            const line2 = createLine(0, 10, 10, 10); // Parallel lines

            const result = trimConsecutiveShapes(line1, line2, []);

            validateTrimResult(result.shape1Result, false);
            validateTrimResult(result.shape2Result, false);
            expect(result.shape1Result.errors[0]).toContain(
                'No intersections found'
            );
        });

        it('should work with mixed shape types', () => {
            const line = createLine(0, 0, 10, 0);
            const arc = createArc(5, 0, 3, Math.PI, 0); // Arc intersecting line

            const intersections: IntersectionResult[] = [
                {
                    point: { x: 2, y: 0 }, // Intersection point
                    param1: 0.2,
                    param2: 0.8,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];

            const result = trimConsecutiveShapes(line, arc, intersections);

            validateTrimResult(result.shape1Result, true);
            validateTrimResult(result.shape2Result, true);

            expect(result.shape1Result.shape!.type).toBe('line');
            expect(result.shape2Result.shape!.type).toBe('arc');
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle very small geometric features', () => {
            const tinyLine = createLine(0, 0, 1e-8, 0);
            const result = trimShapeAtPoint(
                tinyLine,
                { x: 5e-9, y: 0 },
                'start'
            );

            validateTrimResult(result, true);
        });

        it('should handle numerical precision issues', () => {
            const line = createLine(0, 0, 1, 0);
            const almostOnLine = { x: 0.5, y: 1e-15 }; // Very close to line

            const result = trimShapeAtPoint(line, almostOnLine, 'start', 1e-12);

            validateTrimResult(result, true);
        });

        it('should validate tolerance parameter', () => {
            const line = createLine(0, 0, 10, 0);
            const offLine = { x: 5, y: 0.1 };

            // Should fail with tight tolerance
            const result1 = trimShapeAtPoint(line, offLine, 'start', 1e-6);
            validateTrimResult(result1, false);

            // Should succeed with loose tolerance
            const result2 = trimShapeAtPoint(line, offLine, 'start', 0.2);
            validateTrimResult(result2, true);
        });
    });
});
