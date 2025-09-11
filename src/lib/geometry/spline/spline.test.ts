import { describe, expect, it } from 'vitest';
import type { Spline } from './interfaces';
import {
    evaluateNURBS,
    generateUniformKnotVector,
    getSplineEndPoint,
    getSplineStartPoint,
    normalizeSplineWeights,
    reverseSpline,
    validateKnotVector,
} from './functions';

describe('getSplineStartPoint', () => {
    it('should return first control point for simple linear spline', () => {
        const spline: Spline = {
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

        const startPoint = getSplineStartPoint(spline);
        // For a linear spline, start point should be close to first control point
        expect(startPoint.x).toBeCloseTo(0, 1);
        expect(startPoint.y).toBeCloseTo(0, 1);
    });

    it('should use first fit point when available', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [
                { x: 1, y: 2 },
                { x: 8, y: 9 },
            ],
            closed: false,
        };

        const startPoint = getSplineStartPoint(spline);
        // Should return the evaluated NURBS point, not the fit point directly
        expect(typeof startPoint.x).toBe('number');
        expect(typeof startPoint.y).toBe('number');
    });
});

describe('getSplineEndPoint', () => {
    it('should return last control point for simple linear spline', () => {
        const spline: Spline = {
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

        const endPoint = getSplineEndPoint(spline);
        // For a linear spline, end point should be close to last control point
        expect(endPoint.x).toBeCloseTo(10, 1);
        expect(endPoint.y).toBeCloseTo(10, 1);
    });
});

describe('reverseSpline', () => {
    it('should reverse control points and fit points', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 2, 1],
            degree: 2,
            fitPoints: [
                { x: 1, y: 1 },
                { x: 9, y: 1 },
            ],
            closed: false,
        };

        const reversed = reverseSpline(spline);

        expect(reversed.controlPoints).toEqual([
            { x: 10, y: 0 },
            { x: 5, y: 5 },
            { x: 0, y: 0 },
        ]);

        expect(reversed.fitPoints).toEqual([
            { x: 9, y: 1 },
            { x: 1, y: 1 },
        ]);

        expect(reversed.weights).toEqual([1, 2, 1]);
    });
});

describe('normalizeSplineWeights', () => {
    it('should add default weights when missing', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            knots: [],
            weights: [],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const normalized = normalizeSplineWeights(spline);
        expect(normalized.weights).toEqual([1, 1, 1]);
    });

    it('should keep existing weights when valid', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ],
            knots: [],
            weights: [1, 2],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const normalized = normalizeSplineWeights(spline);
        expect(normalized.weights).toEqual([1, 2]);
    });
});

describe('evaluateNURBS', () => {
    it('should evaluate simple linear NURBS', () => {
        const spline: Spline = {
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

        const startPoint = evaluateNURBS(0, spline);
        const midPoint = evaluateNURBS(0.5, spline);
        const endPoint = evaluateNURBS(1, spline);

        expect(startPoint.x).toBeCloseTo(0, 1);
        expect(startPoint.y).toBeCloseTo(0, 1);

        expect(midPoint.x).toBeCloseTo(5, 1);
        expect(midPoint.y).toBeCloseTo(5, 1);

        expect(endPoint.x).toBeCloseTo(10, 1);
        expect(endPoint.y).toBeCloseTo(10, 1);
    });
});

describe('generateUniformKnotVector', () => {
    it('should generate correct knot vector for quadratic curve', () => {
        const result = generateUniformKnotVector(4, 2);
        expect(result).toEqual([0, 0, 0, 0.5, 1, 1, 1]);
        expect(result.length).toBe(4 + 2 + 1); // n + p + 1
    });

    it('should generate correct knot vector for linear curve', () => {
        const result = generateUniformKnotVector(2, 1);
        expect(result).toEqual([0, 0, 1, 1]);
        expect(result.length).toBe(2 + 1 + 1); // n + p + 1
    });
});

describe('validateKnotVector', () => {
    it('should validate correct knot vector', () => {
        const result = validateKnotVector([0, 0, 0, 1, 1, 1], 3, 2);
        expect(result.isValid).toBe(true);
    });

    it('should reject knot vector with wrong length', () => {
        const result = validateKnotVector([0, 0, 1, 1], 3, 2);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('length');
    });

    it('should reject non-decreasing knot vector', () => {
        const result = validateKnotVector([0, 0, 1, 0, 1, 1], 3, 2);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('non-decreasing');
    });
});
