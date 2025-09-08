import { describe, it, expect } from 'vitest';
import {
    getCircleStartPoint,
    getCircleEndPoint,
    reverseCircle,
    getCirclePointAt,
    isCircle,
    generateCirclePoints,
} from './circle';
import type { Circle, Arc, Line, Geometry } from '../types/geometry';

describe('getCircleStartPoint', () => {
    it('should return point at rightmost position of circle', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const startPoint = getCircleStartPoint(circle);
        expect(startPoint.x).toBe(10);
        expect(startPoint.y).toBe(0);
    });

    it('should handle circle with offset center', () => {
        const circle: Circle = {
            center: { x: 5, y: -3 },
            radius: 2,
        };

        const startPoint = getCircleStartPoint(circle);
        expect(startPoint.x).toBe(7);
        expect(startPoint.y).toBe(-3);
    });

    it('should handle zero radius circle', () => {
        const circle: Circle = {
            center: { x: 1, y: 2 },
            radius: 0,
        };

        const startPoint = getCircleStartPoint(circle);
        expect(startPoint.x).toBe(1);
        expect(startPoint.y).toBe(2);
    });

    it('should handle negative radius circle', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: -5,
        };

        const startPoint = getCircleStartPoint(circle);
        expect(startPoint.x).toBe(-5);
        expect(startPoint.y).toBe(0);
    });
});

describe('getCircleEndPoint', () => {
    it('should return same point as start point', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const startPoint = getCircleStartPoint(circle);
        const endPoint = getCircleEndPoint(circle);

        expect(endPoint.x).toBe(startPoint.x);
        expect(endPoint.y).toBe(startPoint.y);
    });

    it('should handle circle with offset center', () => {
        const circle: Circle = {
            center: { x: 5, y: -3 },
            radius: 2,
        };

        const endPoint = getCircleEndPoint(circle);
        expect(endPoint.x).toBe(7);
        expect(endPoint.y).toBe(-3);
    });
});

describe('reverseCircle', () => {
    it('should return the same circle unchanged', () => {
        const circle: Circle = {
            center: { x: 5, y: 10 },
            radius: 3,
        };

        const reversed = reverseCircle(circle);
        expect(reversed).toEqual(circle);
        expect(reversed).toBe(circle); // Should be the same reference
    });

    it('should handle zero radius circle', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 0,
        };

        const reversed = reverseCircle(circle);
        expect(reversed).toEqual(circle);
    });
});

describe('getCirclePointAt', () => {
    it('should return rightmost point at t=0', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const point = getCirclePointAt(circle, 0);
        expect(point.x).toBeCloseTo(10);
        expect(point.y).toBeCloseTo(0);
    });

    it('should return topmost point at t=0.25', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const point = getCirclePointAt(circle, 0.25);
        expect(point.x).toBeCloseTo(0);
        expect(point.y).toBeCloseTo(10);
    });

    it('should return leftmost point at t=0.5', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const point = getCirclePointAt(circle, 0.5);
        expect(point.x).toBeCloseTo(-10);
        expect(point.y).toBeCloseTo(0);
    });

    it('should return bottommost point at t=0.75', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const point = getCirclePointAt(circle, 0.75);
        expect(point.x).toBeCloseTo(0);
        expect(point.y).toBeCloseTo(-10);
    });

    it('should return rightmost point at t=1', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        const point = getCirclePointAt(circle, 1);
        expect(point.x).toBeCloseTo(10);
        expect(point.y).toBeCloseTo(0);
    });

    it('should handle circle with offset center', () => {
        const circle: Circle = {
            center: { x: 5, y: -3 },
            radius: 2,
        };

        const point = getCirclePointAt(circle, 0.25);
        expect(point.x).toBeCloseTo(5);
        expect(point.y).toBeCloseTo(-1);
    });

    it('should handle t values outside [0,1]', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        // t = 1.25 should be equivalent to t = 0.25
        const point1 = getCirclePointAt(circle, 1.25);
        const point2 = getCirclePointAt(circle, 0.25);
        expect(point1.x).toBeCloseTo(point2.x);
        expect(point1.y).toBeCloseTo(point2.y);

        // t = -0.25 should be equivalent to t = 0.75
        const point3 = getCirclePointAt(circle, -0.25);
        const point4 = getCirclePointAt(circle, 0.75);
        expect(point3.x).toBeCloseTo(point4.x);
        expect(point3.y).toBeCloseTo(point4.y);
    });

    it('should handle zero radius circle', () => {
        const circle: Circle = {
            center: { x: 5, y: 10 },
            radius: 0,
        };

        const point = getCirclePointAt(circle, 0.5);
        expect(point.x).toBe(5);
        expect(point.y).toBe(10);
    });
});

describe('isCircle', () => {
    it('should return true for circle geometry', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        expect(isCircle(circle)).toBe(true);
    });

    it('should return false for arc geometry', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        expect(isCircle(arc)).toBe(false);
    });

    it('should return false for line geometry', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };

        expect(isCircle(line)).toBe(false);
    });

    it('should return false for object without center', () => {
        const notCircle = {
            radius: 10,
            someOtherProperty: true,
        };

        expect(isCircle(notCircle as unknown as Geometry)).toBe(false);
    });

    it('should return false for object without radius', () => {
        const notCircle = {
            center: { x: 0, y: 0 },
            someOtherProperty: true,
        };

        expect(isCircle(notCircle as unknown as Geometry)).toBe(false);
    });

    it('should return false for object with startAngle (arc)', () => {
        const notCircle = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
        };

        expect(isCircle(notCircle as unknown as Geometry)).toBe(false);
    });
});

describe('generateCirclePoints', () => {
    it('should generate minimum 32 segments for small circles', () => {
        const points = generateCirclePoints({ x: 0, y: 0 }, 1);
        expect(points.length).toBeGreaterThanOrEqual(33); // 32 segments + 1
    });

    it('should generate more segments for larger circles', () => {
        const radius = 100;
        const points = generateCirclePoints({ x: 0, y: 0 }, radius);
        const expectedSegments = Math.ceil((radius * 2 * Math.PI) / 5); // ~5mm segments
        expect(points.length).toBe(expectedSegments + 1);
    });

    it('should start and end at same point', () => {
        const center = { x: 5, y: 10 };
        const radius = 3;
        const points = generateCirclePoints(center, radius);

        expect(points[0].x).toBeCloseTo(points[points.length - 1].x);
        expect(points[0].y).toBeCloseTo(points[points.length - 1].y);
    });

    it('should generate points on circle circumference', () => {
        const center = { x: 0, y: 0 };
        const radius = 10;
        const points = generateCirclePoints(center, radius);

        // Check that all points are at the correct distance from center
        points.forEach((point) => {
            const distance = Math.sqrt(
                (point.x - center.x) ** 2 + (point.y - center.y) ** 2
            );
            expect(distance).toBeCloseTo(radius);
        });
    });

    it('should handle zero radius', () => {
        const center = { x: 5, y: -2 };
        const points = generateCirclePoints(center, 0);

        expect(points.length).toBeGreaterThan(0);

        // All points should be at center
        points.forEach((point) => {
            expect(point.x).toBeCloseTo(center.x);
            expect(point.y).toBeCloseTo(center.y);
        });
    });

    it('should handle negative radius', () => {
        const center = { x: 0, y: 0 };
        const radius = -5;
        const points = generateCirclePoints(center, radius);

        // Should still generate points at distance |radius| from center
        points.forEach((point) => {
            const distance = Math.sqrt(
                (point.x - center.x) ** 2 + (point.y - center.y) ** 2
            );
            expect(distance).toBeCloseTo(Math.abs(radius));
        });
    });

    it('should generate evenly spaced points', () => {
        const center = { x: 0, y: 0 };
        const radius = 10;
        const points = generateCirclePoints(center, radius);

        // Check that consecutive points have approximately equal angular spacing
        const expectedAngleStep = (2 * Math.PI) / (points.length - 1);

        for (let i = 1; i < points.length - 1; i++) {
            const angle1 = Math.atan2(points[i - 1].y, points[i - 1].x);
            const angle2 = Math.atan2(points[i].y, points[i].x);

            let angleDiff = angle2 - angle1;
            if (angleDiff < 0) angleDiff += 2 * Math.PI;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

            expect(Math.abs(angleDiff)).toBeCloseTo(expectedAngleStep, 1);
        }
    });
});
