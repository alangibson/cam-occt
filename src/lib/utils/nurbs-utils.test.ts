import { describe, it, expect } from 'vitest';
import {
    generateUniformKnotVector,
    generateValidKnotVector,
    validateKnotVector,
    repairKnotVector,
} from './nurbs-utils.js';

describe('nurbs-utils', () => {
    describe('generateUniformKnotVector', () => {
        it('should generate correct knot vector for quadratic curve with 4 control points', () => {
            const result = generateUniformKnotVector(4, 2);

            expect(result).toEqual([0, 0, 0, 0.5, 1, 1, 1]);
            expect(result.length).toBe(4 + 2 + 1); // n + p + 1
        });

        it('should generate correct knot vector for cubic curve with 5 control points', () => {
            const result = generateUniformKnotVector(5, 3);

            expect(result).toEqual([0, 0, 0, 0, 0.5, 1, 1, 1, 1]);
            expect(result.length).toBe(5 + 3 + 1); // n + p + 1
        });

        it('should generate correct knot vector for linear curve with 2 control points', () => {
            const result = generateUniformKnotVector(2, 1);

            expect(result).toEqual([0, 0, 1, 1]);
            expect(result.length).toBe(2 + 1 + 1); // n + p + 1
        });

        it('should generate correct knot vector for degree 0 curve', () => {
            const result = generateUniformKnotVector(1, 0);

            expect(result).toEqual([0, 1]);
            expect(result.length).toBe(1 + 0 + 1); // n + p + 1
        });

        it('should handle many control points correctly', () => {
            const result = generateUniformKnotVector(10, 3);

            expect(result.length).toBe(10 + 3 + 1);
            expect(result.slice(0, 4)).toEqual([0, 0, 0, 0]); // First knots clamped
            expect(result.slice(-4)).toEqual([1, 1, 1, 1]); // Last knots clamped
            // Check non-decreasing manually
            for (let i = 1; i < result.length; i++) {
                expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
            }
        });

        it('should generate proper clamping with degree + 1 multiplicity', () => {
            const result = generateUniformKnotVector(6, 3);

            // First knot should appear degree + 1 times
            expect(result.slice(0, 4)).toEqual([0, 0, 0, 0]);

            // Last knot should appear degree + 1 times
            expect(result.slice(-4)).toEqual([1, 1, 1, 1]);
        });
    });

    describe('generateValidKnotVector', () => {
        it('should be an alias for generateUniformKnotVector', () => {
            const numControlPoints = 5;
            const degree = 2;

            const result1 = generateValidKnotVector(numControlPoints, degree);
            const result2 = generateUniformKnotVector(numControlPoints, degree);

            expect(result1).toEqual(result2);
        });

        it('should work with different parameters', () => {
            const result = generateValidKnotVector(3, 1);

            expect(result).toEqual([0, 0, 0.5, 1, 1]);
        });
    });

    describe('validateKnotVector', () => {
        it('should validate a correct uniform knot vector', () => {
            const knots = [0, 0, 0, 0.5, 1, 1, 1];
            const result = validateKnotVector(knots, 4, 2);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject null or undefined knot vector', () => {
            const result1 = validateKnotVector(
                null as unknown as number[],
                4,
                2
            );
            const result2 = validateKnotVector(
                undefined as unknown as number[],
                4,
                2
            );

            expect(result1.isValid).toBe(false);
            expect(result1.error).toBe('Knot vector must be an array');
            expect(result2.isValid).toBe(false);
            expect(result2.error).toBe('Knot vector must be an array');
        });

        it('should reject non-array input', () => {
            const result = validateKnotVector(
                'not-an-array' as unknown as number[],
                4,
                2
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Knot vector must be an array');
        });

        it('should reject incorrect length', () => {
            const knots = [0, 0, 1, 1]; // Too short for 4 control points, degree 2
            const result = validateKnotVector(knots, 4, 2);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                'Knot vector length 4 does not match expected length 7'
            );
        });

        it('should reject non-decreasing knot values', () => {
            const knots = [0, 0, 0, 0.8, 0.4, 1, 1]; // 0.8 > 0.4 violation
            const result = validateKnotVector(knots, 4, 2);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Knot vector must be non-decreasing');
        });

        it('should reject insufficient first knot multiplicity', () => {
            const knots = [0, 0, 0.2, 0.5, 1, 1, 1]; // Only 2 zeros at start, need 3 for degree 2
            const result = validateKnotVector(knots, 4, 2);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                'First knot multiplicity 2 is less than degree + 1 (3)'
            );
        });

        it('should reject insufficient last knot multiplicity', () => {
            const knots = [0, 0, 0, 0.5, 0.8, 1, 1]; // Only 2 ones at end, need 3 for degree 2
            const result = validateKnotVector(knots, 4, 2);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                'Last knot multiplicity 2 is less than degree + 1 (3)'
            );
        });

        it('should validate complex knot vector with internal repeats', () => {
            const knots = [0, 0, 0, 0.3, 0.3, 0.7, 1, 1, 1];
            const result = validateKnotVector(knots, 6, 2);

            expect(result.isValid).toBe(true);
        });

        it('should validate degree 0 curve', () => {
            const knots = [0, 1];
            const result = validateKnotVector(knots, 1, 0);

            expect(result.isValid).toBe(true);
        });

        it('should validate linear curve', () => {
            const knots = [0, 0, 1, 1];
            const result = validateKnotVector(knots, 2, 1);

            expect(result.isValid).toBe(true);
        });

        it('should handle equal first and last knots', () => {
            const knots = [0, 0, 0, 0, 0, 0, 0]; // All zeros - first and last are same
            const result = validateKnotVector(knots, 4, 2);

            // When all knots are the same, both first and last multiplicity would be the full length
            // This should be valid as it satisfies the degree + 1 requirement
            expect(result.isValid).toBe(true);
        });
    });

    describe('repairKnotVector', () => {
        it('should repair invalid knot vector by generating uniform vector', () => {
            const invalidKnots = [0, 1, 2, 3]; // Wrong format
            const result = repairKnotVector(invalidKnots, 4, 2);

            const expected = generateUniformKnotVector(4, 2);
            expect(result).toEqual(expected);
        });

        it('should repair empty knot vector', () => {
            const invalidKnots: number[] = [];
            const result = repairKnotVector(invalidKnots, 3, 1);

            const expected = generateUniformKnotVector(3, 1);
            expect(result).toEqual(expected);
        });

        it('should repair decreasing knot vector', () => {
            const invalidKnots = [1, 0.5, 0]; // Decreasing
            const result = repairKnotVector(invalidKnots, 2, 1);

            const expected = generateUniformKnotVector(2, 1);
            expect(result).toEqual(expected);
        });

        it('should repair even if original was valid', () => {
            const validKnots = [0, 0, 0, 0.5, 1, 1, 1]; // Already valid
            const result = repairKnotVector(validKnots, 4, 2);

            const expected = generateUniformKnotVector(4, 2);
            expect(result).toEqual(expected);
        });

        it('should work with different parameters', () => {
            const invalidKnots = [0, 1]; // Wrong for degree 3
            const result = repairKnotVector(invalidKnots, 5, 3);

            const expected = generateUniformKnotVector(5, 3);
            expect(result).toEqual(expected);
            expect(result.length).toBe(5 + 3 + 1);
        });
    });

    describe('integration tests', () => {
        it('should validate generated knot vectors', () => {
            const testCases = [
                { controlPoints: 3, degree: 1 },
                { controlPoints: 4, degree: 2 },
                { controlPoints: 5, degree: 3 },
                { controlPoints: 10, degree: 2 },
                { controlPoints: 1, degree: 0 },
            ];

            for (const testCase of testCases) {
                const knots = generateUniformKnotVector(
                    testCase.controlPoints,
                    testCase.degree
                );
                const validation = validateKnotVector(
                    knots,
                    testCase.controlPoints,
                    testCase.degree
                );

                expect(validation.isValid).toBe(true);
                expect(validation.error).toBeUndefined();
            }
        });

        it('should repair invalid vectors to valid ones', () => {
            const testCases = [
                { controlPoints: 3, degree: 1, invalid: [1, 0, 0.5] },
                { controlPoints: 4, degree: 2, invalid: [0, 1] },
                { controlPoints: 5, degree: 3, invalid: [] },
            ];

            for (const testCase of testCases) {
                const repaired = repairKnotVector(
                    testCase.invalid,
                    testCase.controlPoints,
                    testCase.degree
                );
                const validation = validateKnotVector(
                    repaired,
                    testCase.controlPoints,
                    testCase.degree
                );

                expect(validation.isValid).toBe(true);
                expect(validation.error).toBeUndefined();
            }
        });
    });
});
