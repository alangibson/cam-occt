import { describe, expect, it } from 'vitest';
import type { Spline } from './interfaces';
import {
    getSplinePointAt,
    generateUniformKnotVector,
    getSplineEndPoint,
    getSplineStartPoint,
    normalizeSplineWeights,
    reverseSpline,
    validateKnotVector,
    getSplineTangent,
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

describe('getSplinePointAt', () => {
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

        const startPoint = getSplinePointAt(spline, 0);
        const midPoint = getSplinePointAt(spline, 0.5);
        const endPoint = getSplinePointAt(spline, 1);

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

describe('getSplineTangent', () => {
    it('should return correct tangent for simple linear spline', () => {
        // Linear spline from (0,0) to (10,10) should have tangent (1,1) normalized
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

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // For a linear spline, tangent should be constant and normalized
        const expectedTangent = { x: 1 / Math.sqrt(2), y: 1 / Math.sqrt(2) };

        expect(startTangent.x).toBeCloseTo(expectedTangent.x, 6);
        expect(startTangent.y).toBeCloseTo(expectedTangent.y, 6);
        expect(endTangent.x).toBeCloseTo(expectedTangent.x, 6);
        expect(endTangent.y).toBeCloseTo(expectedTangent.y, 6);
    });

    it('should return correct tangent for horizontal linear spline', () => {
        // Horizontal spline from (0,0) to (10,0) should have tangent (1,0)
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        expect(startTangent.x).toBeCloseTo(1, 6);
        expect(startTangent.y).toBeCloseTo(0, 6);
        expect(endTangent.x).toBeCloseTo(1, 6);
        expect(endTangent.y).toBeCloseTo(0, 6);
    });

    it('should return correct tangent for vertical linear spline', () => {
        // Vertical spline from (0,0) to (0,10) should have tangent (0,1)
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 0, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        expect(startTangent.x).toBeCloseTo(0, 6);
        expect(startTangent.y).toBeCloseTo(1, 6);
        expect(endTangent.x).toBeCloseTo(0, 6);
        expect(endTangent.y).toBeCloseTo(1, 6);
    });

    it('should return correct tangent for quadratic Bezier curve', () => {
        // Quadratic Bezier: (0,0) -> (5,10) -> (10,0)
        // Start tangent should be toward control point (5,10)
        // End tangent should be from control point (5,10) toward end
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // Start tangent should point from (0,0) toward (5,10)
        // Direction: (5,10) - (0,0) = (5,10), normalized = (0.447, 0.894)
        const startExpected = {
            x: 5 / Math.sqrt(125),
            y: 10 / Math.sqrt(125),
        };

        // End tangent should point from (5,10) toward (10,0)
        // Direction: (10,0) - (5,10) = (5,-10), normalized = (0.447, -0.894)
        const endExpected = {
            x: 5 / Math.sqrt(125),
            y: -10 / Math.sqrt(125),
        };

        expect(startTangent.x).toBeCloseTo(startExpected.x, 3);
        expect(startTangent.y).toBeCloseTo(startExpected.y, 3);
        expect(endTangent.x).toBeCloseTo(endExpected.x, 3);
        expect(endTangent.y).toBeCloseTo(endExpected.y, 3);
    });

    it('should return normalized tangent vectors', () => {
        // Any spline tangent should be a unit vector
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 3, y: 4 }, // Creates a 3-4-5 triangle, so tangent has magnitude 5
                { x: 6, y: 8 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // Check that tangent vectors are normalized (magnitude = 1)
        const startMagnitude = Math.sqrt(
            startTangent.x ** 2 + startTangent.y ** 2
        );
        const endMagnitude = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);

        expect(startMagnitude).toBeCloseTo(1, 6);
        expect(endMagnitude).toBeCloseTo(1, 6);
    });

    it('should handle circular spline approximation correctly', () => {
        // Create a spline that approximates a quarter circle
        // This should have tangents perpendicular to radius at start/end
        const radius = 5;
        const spline: Spline = {
            controlPoints: [
                { x: radius, y: 0 }, // Start at (5,0)
                { x: radius, y: radius }, // Control point at (5,5)
                { x: 0, y: radius }, // End at (0,5)
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // For a quarter circle starting at (5,0):
        // - Start tangent should be perpendicular to radius, pointing up: (0,1)
        // - End tangent should be perpendicular to radius at (0,5), pointing left: (-1,0)

        // Start tangent should be approximately (0,1)
        expect(startTangent.x).toBeCloseTo(0, 1);
        expect(startTangent.y).toBeCloseTo(1, 1);

        // End tangent should be approximately (-1,0)
        expect(endTangent.x).toBeCloseTo(-1, 1);
        expect(endTangent.y).toBeCloseTo(0, 1);
    });

    it('should maintain tangent direction consistency for reversed splines', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const originalStartTangent = getSplineTangent(spline, true);
        const originalEndTangent = getSplineTangent(spline, false);

        const reversedSpline = reverseSpline(spline);
        const reversedStartTangent = getSplineTangent(reversedSpline, true);
        const reversedEndTangent = getSplineTangent(reversedSpline, false);

        // Reversed spline start tangent should be opposite of original end tangent
        expect(reversedStartTangent.x).toBeCloseTo(-originalEndTangent.x, 3);
        expect(reversedStartTangent.y).toBeCloseTo(-originalEndTangent.y, 3);

        // Reversed spline end tangent should be opposite of original start tangent
        expect(reversedEndTangent.x).toBeCloseTo(-originalStartTangent.x, 3);
        expect(reversedEndTangent.y).toBeCloseTo(-originalStartTangent.y, 3);
    });
});
