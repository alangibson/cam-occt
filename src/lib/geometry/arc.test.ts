import { describe, it, expect } from 'vitest';
import {
    getArcStartPoint,
    getArcEndPoint,
    reverseArc,
    getArcPointAt,
    tessellateArc,
    isArc,
    generateArcPoints,
} from './arc';
import type { Arc, Line, Geometry } from '../types/geometry';

describe('getArcStartPoint', () => {
    it('should calculate start point for arc at 0 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const startPoint = getArcStartPoint(arc);
        expect(startPoint.x).toBeCloseTo(10);
        expect(startPoint.y).toBeCloseTo(0);
    });

    it('should calculate start point for arc at 90 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: Math.PI / 2,
            endAngle: Math.PI,
            clockwise: false,
        };

        const startPoint = getArcStartPoint(arc);
        expect(startPoint.x).toBeCloseTo(0);
        expect(startPoint.y).toBeCloseTo(5);
    });

    it('should calculate start point for arc with offset center', () => {
        const arc: Arc = {
            center: { x: 10, y: 20 },
            radius: 3,
            startAngle: 0,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const startPoint = getArcStartPoint(arc);
        expect(startPoint.x).toBeCloseTo(13);
        expect(startPoint.y).toBeCloseTo(20);
    });
});

describe('getArcEndPoint', () => {
    it('should calculate end point for arc at 90 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const endPoint = getArcEndPoint(arc);
        expect(endPoint.x).toBeCloseTo(0);
        expect(endPoint.y).toBeCloseTo(10);
    });

    it('should calculate end point for arc at 180 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: Math.PI / 2,
            endAngle: Math.PI,
            clockwise: false,
        };

        const endPoint = getArcEndPoint(arc);
        expect(endPoint.x).toBeCloseTo(-5);
        expect(endPoint.y).toBeCloseTo(0);
    });

    it('should calculate end point for arc with offset center', () => {
        const arc: Arc = {
            center: { x: 10, y: 20 },
            radius: 3,
            startAngle: 0,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const endPoint = getArcEndPoint(arc);
        expect(endPoint.x).toBeCloseTo(10 + 3 * Math.cos(Math.PI / 4));
        expect(endPoint.y).toBeCloseTo(20 + 3 * Math.sin(Math.PI / 4));
    });
});

describe('reverseArc', () => {
    it('should reverse counter-clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const reversed = reverseArc(arc);
        expect(reversed.startAngle).toBe(Math.PI / 2);
        expect(reversed.endAngle).toBe(0);
        expect(reversed.clockwise).toBe(true);
        expect(reversed.center).toEqual(arc.center);
        expect(reversed.radius).toBe(arc.radius);
    });

    it('should reverse clockwise arc', () => {
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 3,
            startAngle: Math.PI,
            endAngle: 0,
            clockwise: true,
        };

        const reversed = reverseArc(arc);
        expect(reversed.startAngle).toBe(0);
        expect(reversed.endAngle).toBe(Math.PI);
        expect(reversed.clockwise).toBe(false);
        expect(reversed.center).toEqual(arc.center);
        expect(reversed.radius).toBe(arc.radius);
    });
});

describe('getArcPointAt', () => {
    it('should return start point at t=0', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const point = getArcPointAt(arc, 0);
        const startPoint = getArcStartPoint(arc);
        expect(point.x).toBeCloseTo(startPoint.x);
        expect(point.y).toBeCloseTo(startPoint.y);
    });

    it('should return end point at t=1', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const point = getArcPointAt(arc, 1);
        const endPoint = getArcEndPoint(arc);
        expect(point.x).toBeCloseTo(endPoint.x);
        expect(point.y).toBeCloseTo(endPoint.y);
    });

    it('should return midpoint at t=0.5 for counter-clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const point = getArcPointAt(arc, 0.5);
        const expectedAngle = Math.PI / 4; // Midpoint angle
        expect(point.x).toBeCloseTo(10 * Math.cos(expectedAngle));
        expect(point.y).toBeCloseTo(10 * Math.sin(expectedAngle));
    });

    it('should handle clockwise arc correctly', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 2,
            endAngle: 0,
            clockwise: true,
        };

        const point = getArcPointAt(arc, 0.5);
        const expectedAngle = Math.PI / 4; // Should be midpoint in clockwise direction
        expect(point.x).toBeCloseTo(10 * Math.cos(expectedAngle));
        expect(point.y).toBeCloseTo(10 * Math.sin(expectedAngle));
    });

    it('should handle angle wrapping for clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 4,
            endAngle: (7 * Math.PI) / 4,
            clockwise: true,
        };

        const startPoint = getArcPointAt(arc, 0);
        const endPoint = getArcPointAt(arc, 1);

        expect(startPoint.x).toBeCloseTo(10 * Math.cos(Math.PI / 4));
        expect(startPoint.y).toBeCloseTo(10 * Math.sin(Math.PI / 4));
        expect(endPoint.x).toBeCloseTo(10 * Math.cos((7 * Math.PI) / 4));
        expect(endPoint.y).toBeCloseTo(10 * Math.sin((7 * Math.PI) / 4));
    });

    it('should handle angle wrapping for counter-clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: (7 * Math.PI) / 4,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const startPoint = getArcPointAt(arc, 0);
        const endPoint = getArcPointAt(arc, 1);

        expect(startPoint.x).toBeCloseTo(10 * Math.cos((7 * Math.PI) / 4));
        expect(startPoint.y).toBeCloseTo(10 * Math.sin((7 * Math.PI) / 4));
        expect(endPoint.x).toBeCloseTo(10 * Math.cos(Math.PI / 4));
        expect(endPoint.y).toBeCloseTo(10 * Math.sin(Math.PI / 4));
    });
});

describe('tessellateArc', () => {
    it('should throw error for less than 2 points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        expect(() => tessellateArc(arc, 1)).toThrow(
            'Arc tessellation requires at least 2 points'
        );
        expect(() => tessellateArc(arc, 0)).toThrow(
            'Arc tessellation requires at least 2 points'
        );
    });

    it('should generate correct number of points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = tessellateArc(arc, 5);
        expect(points).toHaveLength(5);
    });

    it('should start and end at correct points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = tessellateArc(arc, 10);
        const startPoint = getArcStartPoint(arc);
        const endPoint = getArcEndPoint(arc);

        expect(points[0].x).toBeCloseTo(startPoint.x);
        expect(points[0].y).toBeCloseTo(startPoint.y);
        expect(points[points.length - 1].x).toBeCloseTo(endPoint.x);
        expect(points[points.length - 1].y).toBeCloseTo(endPoint.y);
    });

    it('should use default 10 points when numPoints not specified', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = tessellateArc(arc);
        expect(points).toHaveLength(10);
    });

    it('should tessellate clockwise arc correctly', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 2,
            endAngle: 0,
            clockwise: true,
        };

        const points = tessellateArc(arc, 3);
        expect(points).toHaveLength(3);

        // First point should be at start angle
        expect(points[0].x).toBeCloseTo(0);
        expect(points[0].y).toBeCloseTo(10);

        // Last point should be at end angle
        expect(points[2].x).toBeCloseTo(10);
        expect(points[2].y).toBeCloseTo(0);
    });
});

describe('isArc', () => {
    it('should return true for arc geometry', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        expect(isArc(arc)).toBe(true);
    });

    it('should return false for line geometry', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };

        expect(isArc(line)).toBe(false);
    });

    it('should return false for object without center and radius', () => {
        const notArc = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
            someOtherProperty: true,
        };

        expect(isArc(notArc as unknown as Geometry)).toBe(false);
    });
});

describe('generateArcPoints', () => {
    it('should generate points with minimum of 16 segments', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 1,
            startAngle: 0,
            endAngle: Math.PI / 4, // Small angle
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        expect(points.length).toBeGreaterThanOrEqual(17); // 16 segments + 1
    });

    it('should generate more segments for larger arcs', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 100,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        const expectedSegments = Math.ceil((Math.PI * 100) / 5); // totalAngle * radius / 5
        expect(points.length).toBe(expectedSegments + 1);
    });

    it('should start and end at correct points', () => {
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = generateArcPoints(arc);

        // First point should be at start
        expect(points[0].x).toBeCloseTo(15); // 5 + 10 * cos(0)
        expect(points[0].y).toBeCloseTo(5); // 5 + 10 * sin(0)

        // Last point should be at end
        const lastPoint = points[points.length - 1];
        expect(lastPoint.x).toBeCloseTo(5); // 5 + 10 * cos(π/2)
        expect(lastPoint.y).toBeCloseTo(15); // 5 + 10 * sin(π/2)
    });

    it('should handle negative angles', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 2,
            endAngle: -Math.PI / 2,
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        expect(points.length).toBeGreaterThan(1);

        // Should start at (0, 10)
        expect(points[0].x).toBeCloseTo(0);
        expect(points[0].y).toBeCloseTo(10);

        // Should end at (0, -10)
        const lastPoint = points[points.length - 1];
        expect(lastPoint.x).toBeCloseTo(0);
        expect(lastPoint.y).toBeCloseTo(-10);
    });

    it('should handle zero radius gracefully', () => {
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 0,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        expect(points.length).toBeGreaterThan(0);

        // All points should be at center
        points.forEach((point) => {
            expect(point.x).toBeCloseTo(5);
            expect(point.y).toBeCloseTo(5);
        });
    });
});
