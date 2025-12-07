import { describe, it, expect } from 'vitest';
import { hashPoint2D } from './point/functions';
import { hashArc } from './arc/functions';
import { hashCircle } from './circle/functions';
import { hashEllipse } from './ellipse/functions';
import { hashLine } from './line/functions';
import { hashPolyline } from './dxf-polyline/functions';
import { hashSpline } from './spline/functions';
import { hashBoundingBox } from './bounding-box/functions';
import type { Point2D } from './point/interfaces';
import type { Arc } from './arc/interfaces';
import type { Circle } from './circle/interfaces';
import type { Ellipse } from './ellipse/interfaces';
import type { Line } from './line/interfaces';
import type { DxfPolyline } from './dxf-polyline/interfaces';
import type { Spline } from './spline/interfaces';
import type { BoundingBoxData } from './bounding-box/interfaces';

describe('Geometry Hash Functions', () => {
    describe('hashPoint2D', () => {
        it('should produce same hash for identical points', async () => {
            const point1: Point2D = { x: 1, y: 2 };
            const point2: Point2D = { x: 1, y: 2 };

            const hash1 = await hashPoint2D(point1);
            const hash2 = await hashPoint2D(point2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different points', async () => {
            const point1: Point2D = { x: 1, y: 2 };
            const point2: Point2D = { x: 1, y: 3 };

            const hash1 = await hashPoint2D(point1);
            const hash2 = await hashPoint2D(point2);

            expect(hash1).not.toBe(hash2);
        });

        it('should be deterministic across property order', async () => {
            const point1 = { x: 5, y: 10 };
            const point2 = { y: 10, x: 5 } as Point2D;

            const hash1 = await hashPoint2D(point1);
            const hash2 = await hashPoint2D(point2);

            expect(hash1).toBe(hash2);
        });
    });

    describe('hashCircle', () => {
        it('should produce same hash for identical circles', async () => {
            const circle1: Circle = { center: { x: 0, y: 0 }, radius: 5 };
            const circle2: Circle = { center: { x: 0, y: 0 }, radius: 5 };

            const hash1 = await hashCircle(circle1);
            const hash2 = await hashCircle(circle2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different radii', async () => {
            const circle1: Circle = { center: { x: 0, y: 0 }, radius: 5 };
            const circle2: Circle = { center: { x: 0, y: 0 }, radius: 10 };

            const hash1 = await hashCircle(circle1);
            const hash2 = await hashCircle(circle2);

            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hashes for different centers', async () => {
            const circle1: Circle = { center: { x: 0, y: 0 }, radius: 5 };
            const circle2: Circle = { center: { x: 1, y: 1 }, radius: 5 };

            const hash1 = await hashCircle(circle1);
            const hash2 = await hashCircle(circle2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('hashArc', () => {
        it('should produce same hash for identical arcs', async () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const hash1 = await hashArc(arc1);
            const hash2 = await hashArc(arc2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different directions', async () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: true,
            };

            const hash1 = await hashArc(arc1);
            const hash2 = await hashArc(arc2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('hashLine', () => {
        it('should produce same hash for identical lines', async () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
            };
            const line2: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
            };

            const hash1 = await hashLine(line1);
            const hash2 = await hashLine(line2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for reversed lines', async () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
            };
            const line2: Line = {
                start: { x: 10, y: 10 },
                end: { x: 0, y: 0 },
            };

            const hash1 = await hashLine(line1);
            const hash2 = await hashLine(line2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('hashEllipse', () => {
        it('should produce same hash for identical ellipses', async () => {
            const ellipse1: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 },
                minorToMajorRatio: 0.5,
            };
            const ellipse2: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 },
                minorToMajorRatio: 0.5,
            };

            const hash1 = await hashEllipse(ellipse1);
            const hash2 = await hashEllipse(ellipse2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different ratios', async () => {
            const ellipse1: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 },
                minorToMajorRatio: 0.5,
            };
            const ellipse2: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 },
                minorToMajorRatio: 0.75,
            };

            const hash1 = await hashEllipse(ellipse1);
            const hash2 = await hashEllipse(ellipse2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('hashPolyline', () => {
        it('should produce same hash for identical polylines', async () => {
            const polyline1: DxfPolyline = {
                closed: false,
                shapes: [],
            };
            const polyline2: DxfPolyline = {
                closed: false,
                shapes: [],
            };

            const hash1 = await hashPolyline(polyline1);
            const hash2 = await hashPolyline(polyline2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for open vs closed', async () => {
            const polyline1: DxfPolyline = {
                closed: false,
                shapes: [],
            };
            const polyline2: DxfPolyline = {
                closed: true,
                shapes: [],
            };

            const hash1 = await hashPolyline(polyline1);
            const hash2 = await hashPolyline(polyline2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('hashSpline', () => {
        it('should produce same hash for identical splines', async () => {
            const spline1: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                degree: 1,
                fitPoints: [],
                closed: false,
            };
            const spline2: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                degree: 1,
                fitPoints: [],
                closed: false,
            };

            const hash1 = await hashSpline(spline1);
            const hash2 = await hashSpline(spline2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different control points', async () => {
            const spline1: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                degree: 1,
                fitPoints: [],
                closed: false,
            };
            const spline2: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 20, y: 20 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                degree: 1,
                fitPoints: [],
                closed: false,
            };

            const hash1 = await hashSpline(spline1);
            const hash2 = await hashSpline(spline2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('hashBoundingBox', () => {
        it('should produce same hash for identical bounding boxes', async () => {
            const bbox1: BoundingBoxData = {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            };
            const bbox2: BoundingBoxData = {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            };

            const hash1 = await hashBoundingBox(bbox1);
            const hash2 = await hashBoundingBox(bbox2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different bounds', async () => {
            const bbox1: BoundingBoxData = {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            };
            const bbox2: BoundingBoxData = {
                min: { x: 0, y: 0 },
                max: { x: 20, y: 20 },
            };

            const hash1 = await hashBoundingBox(bbox1);
            const hash2 = await hashBoundingBox(bbox2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Hash Properties', () => {
        it('all hash functions should return 64-character hex strings', async () => {
            const point: Point2D = { x: 1, y: 2 };
            const circle: Circle = { center: { x: 0, y: 0 }, radius: 5 };
            const line: Line = { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };

            const pointHash = await hashPoint2D(point);
            const circleHash = await hashCircle(circle);
            const lineHash = await hashLine(line);

            expect(pointHash).toHaveLength(64);
            expect(circleHash).toHaveLength(64);
            expect(lineHash).toHaveLength(64);

            expect(pointHash).toMatch(/^[0-9a-f]{64}$/);
            expect(circleHash).toMatch(/^[0-9a-f]{64}$/);
            expect(lineHash).toMatch(/^[0-9a-f]{64}$/);
        });
    });
});
