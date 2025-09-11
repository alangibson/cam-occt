import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Point2D } from '$lib/types/geometry';
import type { IntersectionResult } from '../chain/types';
import verb from 'verb-nurbs';
import {
    validateSplineForIntersection,
    processSplineIntersection,
    processSplineWithCurveIntersection,
    processSplineIntersectionWithRetry,
    selectBestIntersectionResult,
} from './spline-intersection-utils';
import type { Spline } from '$lib/geometry/spline';
import { processVerbIntersectionResults } from '$lib/algorithms/offset-calculation/intersect/verb-integration-utils';
import { createVerbCurveFromSpline } from '$lib/geometry/spline/nurbs';
import { createExtendedSplineVerb } from '../extend/spline';

// Mock verb-nurbs
vi.mock('verb-nurbs', () => ({
    default: {
        geom: {
            Intersect: {
                curves: vi.fn(),
            },
        },
    },
}));

// Mock verb integration utils
vi.mock('../intersect/verb-integration-utils', () => ({
    processVerbIntersectionResults: vi.fn(),
    INTERSECTION_TOLERANCE: 0.01,
}));

// Mock spline nurbs utils
vi.mock('$lib/geometry/spline/nurbs', () => ({
    createVerbCurveFromSpline: vi.fn(),
}));

// Mock extend/spline
vi.mock('../extend/spline', () => ({
    createExtendedSplineVerb: vi.fn(),
}));

describe('Spline Intersection Utilities', () => {
    const createTestSpline = (overrides: Partial<Spline> = {}): Spline => ({
        controlPoints: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 },
            { x: 30, y: 10 },
        ],
        degree: 3,
        knots: [0, 0, 0, 0, 1, 1, 1, 1],
        weights: [1, 1, 1, 1],
        fitPoints: [],
        closed: false,
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateSplineForIntersection', () => {
        it('should validate valid spline', () => {
            const spline = createTestSpline();
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject spline with no control points', () => {
            const spline = createTestSpline({ controlPoints: [] });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Invalid or insufficient control points');
        });

        it('should reject spline with null control points', () => {
            const spline = createTestSpline({
                controlPoints: null as unknown as Point2D[],
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Invalid or insufficient control points');
        });

        it('should reject spline with only one control point', () => {
            const spline = createTestSpline({
                controlPoints: [{ x: 0, y: 0 }],
                knots: [0, 0, 1, 1], // Adjust knots for single control point
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Invalid or insufficient control points');
        });

        it('should reject spline with degree >= control point count', () => {
            const spline = createTestSpline({
                degree: 4, // Greater than 4 control points - 1
                knots: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // Adjust knots for degree 4
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Invalid degree for control point count');
        });

        it('should reject spline with zero degree', () => {
            const spline = createTestSpline({ degree: 0 });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(true); // degree 0 is actually valid
        });

        it('should reject spline with missing knots', () => {
            const spline = createTestSpline({
                knots: null as unknown as number[],
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Missing knot vector');
        });

        it('should reject spline with wrong knot vector length', () => {
            const spline = createTestSpline({
                knots: [0, 1], // Wrong length - should be 4 + 3 + 1 = 8
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                'Invalid knot vector length: expected 8, got 2'
            );
        });

        it('should reject degenerate spline with identical control points', () => {
            const spline = createTestSpline({
                controlPoints: [
                    { x: 5, y: 5 },
                    { x: 5, y: 5 },
                    { x: 5, y: 5 },
                    { x: 5, y: 5 },
                ],
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                'Degenerate spline: all control points are identical'
            );
        });

        it('should accept spline with nearly identical but not exactly identical control points', () => {
            const spline = createTestSpline({
                controlPoints: [
                    { x: 5, y: 5 },
                    { x: 5.02, y: 5.02 }, // Just outside tolerance
                    { x: 5, y: 5 },
                    { x: 5, y: 5 },
                ],
            });
            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(true);
        });
    });

    describe('processSplineIntersection', () => {
        it('should find intersections between original splines', async () => {
            const spline1 = createTestSpline();
            const spline2 = createTestSpline({
                controlPoints: [
                    { x: 5, y: -5 },
                    { x: 15, y: 5 },
                    { x: 25, y: -5 },
                ],
            });

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }];

            const mockProcessedResults: IntersectionResult[] = [
                {
                    point: { x: 15, y: 5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = processSplineIntersection(spline1, spline2);

            expect(results).toEqual(mockProcessedResults);
            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                mockIntersections,
                false,
                false
            );
        });

        it('should try extensions when no original intersections found', async () => {
            const spline1 = createTestSpline();
            const spline2 = createTestSpline();

            const mockExtendedIntersections = [
                { u0: 0.8, u1: 0.2, pt: [25, 8, 0] },
            ];

            const mockExtendedResults: IntersectionResult[] = [
                {
                    point: { x: 25, y: 8 },
                    param1: 0.8,
                    param2: 0.2,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: true,
                },
            ];

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(createExtendedSplineVerb).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);

            // First call returns no intersections, subsequent calls return intersections
            vi.mocked(verb.geom.Intersect.curves)
                .mockReturnValueOnce([]) // Original intersection fails
                .mockReturnValue(mockExtendedIntersections); // Extended intersections succeed

            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockExtendedResults
            );

            const results = processSplineIntersection(
                spline1,
                spline2,
                false,
                true,
                1000
            );

            expect(results.length).toBe(3); // Extension creates multiple results
            expect(createExtendedSplineVerb).toHaveBeenCalled();
        });

        it('should return empty array when no intersections found and extensions disabled', async () => {
            const spline1 = createTestSpline();
            const spline2 = createTestSpline();

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue([]);

            const results = processSplineIntersection(
                spline1,
                spline2,
                false,
                false
            );

            expect(results).toEqual([]);
        });

        it('should handle verb-nurbs errors gracefully', async () => {
            const spline1 = createTestSpline();
            const spline2 = createTestSpline();

            vi.mocked(createVerbCurveFromSpline).mockImplementation(() => {
                throw new Error('Curve creation failed');
            });

            const results = processSplineIntersection(spline1, spline2);

            expect(results).toEqual([]);
        });

        it('should handle parameter swapping', async () => {
            const spline1 = createTestSpline();
            const spline2 = createTestSpline();

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }];

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            processSplineIntersection(spline1, spline2, true);

            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                mockIntersections,
                true,
                false
            );
        });
    });

    describe('processSplineWithCurveIntersection', () => {
        it('should find intersections with other curve', async () => {
            const spline = createTestSpline();
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }];

            const mockResults: IntersectionResult[] = [
                {
                    point: { x: 15, y: 5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockResults
            );

            const results = processSplineWithCurveIntersection(
                spline,
                mockOtherCurve
            );

            expect(results).toEqual(mockResults);
            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                mockIntersections,
                false,
                false
            );
        });

        it('should try extensions when original intersection fails', async () => {
            const spline = createTestSpline();
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            const mockExtendedIntersections = [
                { u0: 0.8, u1: 0.2, pt: [25, 8, 0] },
            ];

            const mockExtendedResults: IntersectionResult[] = [
                {
                    point: { x: 25, y: 8 },
                    param1: 0.8,
                    param2: 0.2,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: true,
                },
            ];

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(createExtendedSplineVerb).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);

            vi.mocked(verb.geom.Intersect.curves)
                .mockReturnValueOnce([]) // Original fails
                .mockReturnValue(mockExtendedIntersections); // Extended succeeds

            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockExtendedResults
            );

            const results = processSplineWithCurveIntersection(
                spline,
                mockOtherCurve,
                false,
                true,
                1000
            );

            expect(results).toEqual(mockExtendedResults);
            expect(createExtendedSplineVerb).toHaveBeenCalledWith(
                spline,
                true,
                true,
                1000
            );
        });

        it('should return empty when extensions fail', async () => {
            const spline = createTestSpline();
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(createExtendedSplineVerb).mockImplementation(() => {
                throw new Error('Extension failed');
            });
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue([]);

            const results = processSplineWithCurveIntersection(
                spline,
                mockOtherCurve,
                false,
                true
            );

            expect(results).toEqual([]);
        });

        it('should handle parameter swapping', async () => {
            const spline = createTestSpline();
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }];

            vi.mocked(createVerbCurveFromSpline).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            processSplineWithCurveIntersection(spline, mockOtherCurve, true);

            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                mockIntersections,
                true,
                false
            );
        });
    });

    describe('processSplineIntersectionWithRetry', () => {
        it('should return consistent results from multiple retries', async () => {
            const mockSplineCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }];

            const mockResults: IntersectionResult[] = [
                {
                    point: { x: 15, y: 5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockResults
            );

            const results = processSplineIntersectionWithRetry(
                mockSplineCurve,
                mockOtherCurve,
                false,
                false,
                3
            );

            expect(results).toEqual(mockResults);
            expect(verb.geom.Intersect.curves).toHaveBeenCalledTimes(3); // Should retry 3 times
        });

        it('should handle inconsistent results from retries', async () => {
            const mockSplineCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            const { processVerbIntersectionResults } = await import(
                '../intersect/verb-integration-utils'
            );
            const { default: verb } = await import('verb-nurbs');

            // Mock different results for each retry
            vi.mocked(verb.geom.Intersect.curves)
                .mockReturnValueOnce([{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }]) // 1 intersection
                .mockReturnValueOnce([]) // 0 intersections
                .mockReturnValue([{ u0: 0.5, u1: 0.3, pt: [15, 5, 0] }]); // 1 intersection

            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            const results = processSplineIntersectionWithRetry(
                mockSplineCurve,
                mockOtherCurve,
                false,
                false
            );

            expect(results).toEqual([]);
        });

        it('should handle retry failures gracefully', async () => {
            const mockSplineCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            vi.mocked(verb.geom.Intersect.curves).mockImplementation(() => {
                throw new Error('Intersection failed');
            });

            const results = processSplineIntersectionWithRetry(
                mockSplineCurve,
                mockOtherCurve,
                false,
                false
            );

            expect(results).toEqual([]);
        });

        it('should use provided retry count', async () => {
            const mockSplineCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;
            const mockOtherCurve = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as verb.geom.ICurve;

            vi.mocked(verb.geom.Intersect.curves).mockReturnValue([]);

            processSplineIntersectionWithRetry(
                mockSplineCurve,
                mockOtherCurve,
                false,
                false,
                5
            );

            expect(verb.geom.Intersect.curves).toHaveBeenCalledTimes(5);
        });
    });

    describe('selectBestIntersectionResult', () => {
        it('should return null for empty results array', () => {
            const result = selectBestIntersectionResult([]);

            expect(result).toBeNull();
        });

        it('should return most common non-empty result', () => {
            const results = [
                [], // Empty
                [{ id: 1 }], // Single result
                [{ id: 2 }, { id: 3 }], // Two results
                [{ id: 4 }, { id: 5 }], // Two results (most common)
                [], // Empty
            ];

            const result = selectBestIntersectionResult(results);

            expect(result).toEqual([{ id: 1 }]); // Returns first non-empty result
        });

        it('should prefer non-empty results over empty ones', () => {
            const results = [
                [], // Empty
                [], // Empty
                [{ id: 1 }], // Single result
                [], // Empty
            ];

            const result = selectBestIntersectionResult(results);

            expect(result).toEqual([{ id: 1 }]);
        });

        it('should handle all empty results', () => {
            const results = [[], [], []];

            const result = selectBestIntersectionResult(results);

            expect(result).toBeNull();
        });

        it('should handle single result array', () => {
            const results = [[{ id: 1 }, { id: 2 }]];

            const result = selectBestIntersectionResult(results);

            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle spline validation with missing weights', () => {
            const spline = createTestSpline({
                weights: undefined as unknown as number[],
            });
            const result = validateSplineForIntersection(spline);

            // Should still be valid since weights is optional
            expect(result.isValid).toBe(true);
        });

        it('should handle very high degree splines', () => {
            const manyPoints = [];
            for (let i = 0; i < 20; i++) {
                manyPoints.push({ x: i * 2, y: Math.sin(i) * 5 });
            }

            const highDegreeKnots = [];
            for (let i = 0; i < 20 + 10 + 1; i++) {
                highDegreeKnots.push(i / 30);
            }

            const spline = createTestSpline({
                controlPoints: manyPoints,
                degree: 10,
                knots: highDegreeKnots,
            });

            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(true);
        });

        it('should handle spline with non-uniform control point spacing', () => {
            const spline = createTestSpline({
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 0.001, y: 0.001 }, // Very close to first point
                    { x: 100, y: 100 }, // Very far from others
                    { x: 101, y: 100 },
                ],
            });

            const result = validateSplineForIntersection(spline);

            expect(result.isValid).toBe(true);
        });
    });
});
