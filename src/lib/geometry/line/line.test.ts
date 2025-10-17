import { describe, expect, it } from 'vitest';
import {
    getLineEndPoint,
    getLinePointAt,
    getLineStartPoint,
    isLine,
    reverseLine,
} from './functions';
import type { Line } from './interfaces';
import type { Geometry } from '$lib/geometry/shape';
import type { Circle } from '$lib/geometry/circle';
import type { Arc } from '$lib/geometry/arc';

describe('getLineStartPoint', () => {
    it('should return the start point of the line', () => {
        const line: Line = {
            start: { x: 5, y: 10 },
            end: { x: 15, y: 20 },
        };

        const startPoint = getLineStartPoint(line);
        expect(startPoint).toEqual({ x: 5, y: 10 });
        expect(startPoint).toBe(line.start); // Should be same reference
    });

    it('should handle line with negative coordinates', () => {
        const line: Line = {
            start: { x: -5, y: -10 },
            end: { x: 3, y: 7 },
        };

        const startPoint = getLineStartPoint(line);
        expect(startPoint).toEqual({ x: -5, y: -10 });
    });

    it('should handle line with zero coordinates', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
        };

        const startPoint = getLineStartPoint(line);
        expect(startPoint).toEqual({ x: 0, y: 0 });
    });

    it('should handle zero-length line', () => {
        const line: Line = {
            start: { x: 5, y: 5 },
            end: { x: 5, y: 5 },
        };

        const startPoint = getLineStartPoint(line);
        expect(startPoint).toEqual({ x: 5, y: 5 });
    });
});

describe('getLineEndPoint', () => {
    it('should return the end point of the line', () => {
        const line: Line = {
            start: { x: 5, y: 10 },
            end: { x: 15, y: 20 },
        };

        const endPoint = getLineEndPoint(line);
        expect(endPoint).toEqual({ x: 15, y: 20 });
        expect(endPoint).toBe(line.end); // Should be same reference
    });

    it('should handle line with negative coordinates', () => {
        const line: Line = {
            start: { x: 3, y: 7 },
            end: { x: -5, y: -10 },
        };

        const endPoint = getLineEndPoint(line);
        expect(endPoint).toEqual({ x: -5, y: -10 });
    });

    it('should handle line with zero coordinates', () => {
        const line: Line = {
            start: { x: 1, y: 1 },
            end: { x: 0, y: 0 },
        };

        const endPoint = getLineEndPoint(line);
        expect(endPoint).toEqual({ x: 0, y: 0 });
    });

    it('should handle zero-length line', () => {
        const line: Line = {
            start: { x: 3, y: 7 },
            end: { x: 3, y: 7 },
        };

        const endPoint = getLineEndPoint(line);
        expect(endPoint).toEqual({ x: 3, y: 7 });
    });
});

describe('reverseLine', () => {
    it('should swap start and end points', () => {
        const line: Line = {
            start: { x: 1, y: 2 },
            end: { x: 10, y: 20 },
        };

        const reversed = reverseLine(line);
        expect(reversed.start).toEqual(line.end);
        expect(reversed.end).toEqual(line.start);
    });

    it('should create new line object', () => {
        const line: Line = {
            start: { x: 1, y: 2 },
            end: { x: 10, y: 20 },
        };

        const reversed = reverseLine(line);
        expect(reversed).not.toBe(line);
    });

    it('should handle negative coordinates', () => {
        const line: Line = {
            start: { x: -5, y: -3 },
            end: { x: 7, y: 11 },
        };

        const reversed = reverseLine(line);
        expect(reversed.start).toEqual({ x: 7, y: 11 });
        expect(reversed.end).toEqual({ x: -5, y: -3 });
    });

    it('should handle zero-length line', () => {
        const line: Line = {
            start: { x: 5, y: 5 },
            end: { x: 5, y: 5 },
        };

        const reversed = reverseLine(line);
        expect(reversed.start).toEqual({ x: 5, y: 5 });
        expect(reversed.end).toEqual({ x: 5, y: 5 });
    });

    it('should be reversible (double reverse returns original)', () => {
        const line: Line = {
            start: { x: 1, y: 2 },
            end: { x: 10, y: 20 },
        };

        const doubleReversed = reverseLine(reverseLine(line));
        expect(doubleReversed.start).toEqual(line.start);
        expect(doubleReversed.end).toEqual(line.end);
    });
});

describe('getLinePointAt', () => {
    it('should return start point at t=0', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 20 },
        };

        const point = getLinePointAt(line, 0);
        expect(point).toEqual(line.start);
    });

    it('should return end point at t=1', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 20 },
        };

        const point = getLinePointAt(line, 1);
        expect(point).toEqual(line.end);
    });

    it('should return midpoint at t=0.5', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 20 },
        };

        const point = getLinePointAt(line, 0.5);
        expect(point.x).toBe(5);
        expect(point.y).toBe(10);
    });

    it('should interpolate correctly at t=0.25', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 8, y: 12 },
        };

        const point = getLinePointAt(line, 0.25);
        expect(point.x).toBe(2);
        expect(point.y).toBe(3);
    });

    it('should interpolate correctly at t=0.75', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 8, y: 12 },
        };

        const point = getLinePointAt(line, 0.75);
        expect(point.x).toBe(6);
        expect(point.y).toBe(9);
    });

    it('should handle negative coordinates', () => {
        const line: Line = {
            start: { x: -10, y: -5 },
            end: { x: 10, y: 15 },
        };

        const point = getLinePointAt(line, 0.5);
        expect(point.x).toBe(0);
        expect(point.y).toBe(5);
    });

    it('should handle t values outside [0,1]', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };

        // t = 1.5 should extrapolate beyond end
        const point1 = getLinePointAt(line, 1.5);
        expect(point1.x).toBe(15);
        expect(point1.y).toBe(15);

        // t = -0.5 should extrapolate before start
        const point2 = getLinePointAt(line, -0.5);
        expect(point2.x).toBe(-5);
        expect(point2.y).toBe(-5);
    });

    it('should handle zero-length line', () => {
        const line: Line = {
            start: { x: 5, y: 7 },
            end: { x: 5, y: 7 },
        };

        const point1 = getLinePointAt(line, 0);
        const point2 = getLinePointAt(line, 0.5);
        const point3 = getLinePointAt(line, 1);

        expect(point1).toEqual({ x: 5, y: 7 });
        expect(point2).toEqual({ x: 5, y: 7 });
        expect(point3).toEqual({ x: 5, y: 7 });
    });

    it('should handle horizontal line', () => {
        const line: Line = {
            start: { x: 2, y: 5 },
            end: { x: 8, y: 5 },
        };

        const point = getLinePointAt(line, 0.5);
        expect(point.x).toBe(5);
        expect(point.y).toBe(5);
    });

    it('should handle vertical line', () => {
        const line: Line = {
            start: { x: 3, y: 1 },
            end: { x: 3, y: 9 },
        };

        const point = getLinePointAt(line, 0.5);
        expect(point.x).toBe(3);
        expect(point.y).toBe(5);
    });

    it('should handle fractional coordinates', () => {
        const line: Line = {
            start: { x: 0.1, y: 0.3 },
            end: { x: 1.1, y: 2.3 },
        };

        const point = getLinePointAt(line, 0.5);
        expect(point.x).toBeCloseTo(0.6);
        expect(point.y).toBeCloseTo(1.3);
    });
});

describe('isLine', () => {
    it('should return true for line geometry', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };

        expect(isLine(line)).toBe(true);
    });

    it('should return false for arc geometry', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        expect(isLine(arc)).toBe(false);
    });

    it('should return false for circle geometry', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };

        expect(isLine(circle)).toBe(false);
    });

    it('should return false for object without start property', () => {
        const notLine = {
            end: { x: 10, y: 10 },
            someOtherProperty: true,
        };

        expect(isLine(notLine as unknown as Geometry)).toBe(false);
    });

    it('should return false for object without end property', () => {
        const notLine = {
            start: { x: 0, y: 0 },
            someOtherProperty: true,
        };

        expect(isLine(notLine as unknown as Geometry)).toBe(false);
    });

    it('should return false for object with only one endpoint', () => {
        const notLine = {
            start: { x: 0, y: 0 },
        };

        expect(isLine(notLine as unknown as Geometry)).toBe(false);
    });

    it('should return true for object with extra properties', () => {
        const lineWithExtra = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
            color: 'red',
            thickness: 2,
        };

        expect(isLine(lineWithExtra as unknown as Geometry)).toBe(true);
    });

    it('should handle null and undefined', () => {
        expect(isLine(null as unknown as Geometry)).toBe(false);
        expect(isLine(undefined as unknown as Geometry)).toBe(false);
    });

    it('should handle primitive values', () => {
        expect(isLine('string' as unknown as Geometry)).toBe(false);
        expect(isLine(123 as unknown as Geometry)).toBe(false);
        expect(isLine(true as unknown as Geometry)).toBe(false);
    });
});
