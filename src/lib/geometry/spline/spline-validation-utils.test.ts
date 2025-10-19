import { describe, expect, it } from 'vitest';
import {
    repairSplineKnotVector,
    validateSplineGeometry2,
    validateSplineKnots,
} from '$lib/geometry/spline/functions.js';
import type { Spline } from '$lib/geometry/spline/interfaces';

describe('spline-validation-utils', () => {
    const createValidSpline = (): Spline => ({
        controlPoints: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
            { x: 3, y: 1 },
        ],
        knots: [0, 0, 0, 0, 1, 1, 1, 1], // Uniform knot vector for cubic spline with 4 control points
        weights: [1, 1, 1, 1],
        degree: 3,
        fitPoints: [],
        closed: false,
    });

    describe('validateSplineGeometry', () => {
        it('should validate a correct spline', () => {
            const spline = createValidSpline();
            const result = validateSplineGeometry2(spline);

            expect(result.isValid).toBe(true);
            expect(result.repairedSpline).toBeUndefined();
        });

        it('should reject spline with no control points', () => {
            const spline: Spline = {
                ...createValidSpline(),
                controlPoints: [],
            };

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeUndefined();
        });

        it('should reject spline with undefined control points', () => {
            const spline: Spline = {
                ...createValidSpline(),
                controlPoints: undefined!,
            };

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeUndefined();
        });

        it('should reject spline with only one control point', () => {
            const spline: Spline = {
                ...createValidSpline(),
                controlPoints: [{ x: 0, y: 0 }],
            };

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeUndefined();
        });

        it('should reject spline with non-array control points', () => {
            const spline = {
                ...createValidSpline(),
                controlPoints: 'not-array',
            } as unknown as Spline;

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeUndefined();
        });

        it('should repair spline with missing knots', () => {
            const spline = {
                ...createValidSpline(),
                knots: undefined,
            } as unknown as Spline;

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.knots).toEqual([
                0, 0, 0, 0, 1, 1, 1, 1,
            ]);
            expect(result.repairedSpline!.weights).toEqual([1, 1, 1, 1]);
            expect(result.repairedSpline!.degree).toBe(3);
        });

        it('should repair spline with wrong knots length', () => {
            const spline: Spline = {
                ...createValidSpline(),
                knots: [0, 0.5, 1], // Wrong length for cubic with 4 points
            };

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.knots).toHaveLength(8);
        });

        it('should use default degree 3 when not specified', () => {
            const spline = {
                ...createValidSpline(),
                degree: undefined,
                knots: undefined,
            } as unknown as Spline;

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.degree).toBe(3);
        });

        it('should repair spline with invalid first knot clamping', () => {
            const spline: Spline = {
                ...createValidSpline(),
                knots: [0, 0.1, 0.2, 0.3, 0.7, 1, 1, 1], // First knots not properly clamped
            };

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.knots.slice(0, 4)).toEqual([
                0, 0, 0, 0,
            ]);
        });

        it('should repair spline with invalid last knot clamping', () => {
            const spline: Spline = {
                ...createValidSpline(),
                knots: [0, 0, 0, 0, 0.7, 0.8, 0.9, 1], // Last knots not properly clamped
            };

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.knots.slice(-4)).toEqual([
                1, 1, 1, 1,
            ]);
        });

        it('should handle spline with different degree', () => {
            const spline = {
                ...createValidSpline(),
                degree: 2,
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                    { x: 2, y: 0 },
                ],
                knots: undefined,
            } as unknown as Spline;

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.knots).toHaveLength(6); // 3 + 2 + 1
        });

        it('should preserve existing weights when repairing', () => {
            const spline = {
                ...createValidSpline(),
                weights: [1, 2, 3, 4],
                knots: undefined,
            } as unknown as Spline;

            const result = validateSplineGeometry2(spline);
            expect(result.isValid).toBe(false);
            expect(result.repairedSpline).toBeDefined();
            expect(result.repairedSpline!.weights).toEqual([1, 2, 3, 4]);
        });
    });

    describe('repairSplineKnotVector', () => {
        it('should repair spline with invalid knots', () => {
            const spline: Spline = {
                ...createValidSpline(),
                knots: [1, 0, 2], // Invalid knots
            };

            const repaired = repairSplineKnotVector(spline);
            expect(repaired.knots).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
            expect(repaired.degree).toBe(3);
            expect(repaired.weights).toEqual([1, 1, 1, 1]);
        });

        it('should use default degree 3 when not specified', () => {
            const spline = {
                ...createValidSpline(),
                degree: undefined,
            } as unknown as Spline;

            const repaired = repairSplineKnotVector(spline);
            expect(repaired.degree).toBe(3);
        });

        it('should preserve existing weights', () => {
            const spline: Spline = {
                ...createValidSpline(),
                weights: [2, 3, 4, 5],
            };

            const repaired = repairSplineKnotVector(spline);
            expect(repaired.weights).toEqual([2, 3, 4, 5]);
        });

        it('should generate default weights when missing', () => {
            const spline = {
                ...createValidSpline(),
                weights: undefined,
            } as unknown as Spline;

            const repaired = repairSplineKnotVector(spline);
            expect(repaired.weights).toEqual([1, 1, 1, 1]);
        });

        it('should preserve all other spline properties', () => {
            const spline: Spline = {
                ...createValidSpline(),
                closed: true,
            };

            const repaired = repairSplineKnotVector(spline);
            expect(repaired.closed).toBe(true);
            expect(repaired.controlPoints).toEqual(spline.controlPoints);
        });
    });

    describe('validateSplineKnots', () => {
        it('should validate correct knot vector', () => {
            const knots = [0, 0, 0, 0, 1, 1, 1, 1];
            const result = validateSplineKnots(knots, 3, 4);

            expect(result).toBe(true);
        });

        it('should reject knots with wrong length', () => {
            const knots = [0, 0, 1, 1]; // Too short
            const result = validateSplineKnots(knots, 3, 4);

            expect(result).toBe(false);
        });

        it('should reject non-decreasing knots', () => {
            const knots = [0, 0, 0, 1, 0.5, 1, 1, 1]; // 1 > 0.5 violation
            const result = validateSplineKnots(knots, 3, 4);

            expect(result).toBe(false);
        });

        it('should reject insufficient first knot multiplicity', () => {
            const knots = [0, 0, 0.2, 0.5, 0.8, 1, 1, 1]; // Only 2 zeros at start
            const result = validateSplineKnots(knots, 3, 4);

            expect(result).toBe(false);
        });

        it('should reject insufficient last knot multiplicity', () => {
            const knots = [0, 0, 0, 0, 0.5, 0.8, 1, 1]; // Only 2 ones at end
            const result = validateSplineKnots(knots, 3, 4);

            expect(result).toBe(false);
        });

        it('should validate quadratic spline knots', () => {
            const knots = [0, 0, 0, 0.5, 1, 1, 1];
            const result = validateSplineKnots(knots, 2, 4);

            expect(result).toBe(true);
        });

        it('should validate linear spline knots', () => {
            const knots = [0, 0, 1, 1];
            const result = validateSplineKnots(knots, 1, 2);

            expect(result).toBe(true);
        });

        it('should validate complex knot vector', () => {
            const knots = [0, 0, 0, 0.3, 0.3, 0.7, 1, 1, 1];
            const result = validateSplineKnots(knots, 2, 6);

            expect(result).toBe(true);
        });

        it('should handle edge case with minimal control points', () => {
            const knots = [0, 0, 1, 1];
            const result = validateSplineKnots(knots, 1, 2);

            expect(result).toBe(true);
        });

        it('should reject when knots have near-equal values that violate clamping', () => {
            // Using a small but non-zero difference that should still fail
            const knots = [0, 0, 0, 0.001, 0.5, 1, 1, 1]; // 0.001 is > EPSILON, violates first clamping
            const result = validateSplineKnots(knots, 3, 4);

            expect(result).toBe(false);
        });
    });
});
