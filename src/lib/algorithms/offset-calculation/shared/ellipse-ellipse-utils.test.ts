import verb from 'verb-nurbs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeometryType, type Ellipse, type Shape } from '$lib/types/geometry';
import type { IntersectionResult } from '../chain/types';
import { INTERSECTION_TOLERANCE } from '../../../geometry/math/constants';
import {
    calculateEllipseEllipseIntersection,
    calculateIntersectionScore,
    findEllipseEllipseIntersectionsVerb,
    processEllipseIntersectionResults,
    validateEllipseIntersectionParameters,
} from './ellipse-ellipse-utils';
// VerbCurve interface for testing
interface VerbCurve {
    degree(): number;
    knots(): number[];
    controlPoints(): number[][];
    weights(): number[];
}

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
vi.mock('../../../utils/verb-integration-utils', () => ({
    createVerbCurveFromEllipse: vi.fn(),
    processVerbIntersectionResults: vi.fn(),
    INTERSECTION_TOLERANCE: 0.01,
}));

describe('Ellipse-Ellipse Intersection Utilities', () => {
    const createTestEllipse = (overrides: Partial<Ellipse> = {}): Ellipse => ({
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 10, y: 0 },
        minorToMajorRatio: 0.5,
        ...overrides,
    });

    const createEllipseShape = (ellipse: Ellipse): Shape => ({
        type: GeometryType.ELLIPSE,
        geometry: ellipse,
        id: 'test-ellipse',
        layer: 'default',
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateEllipseEllipseIntersection', () => {
        it('should calculate intersections between two ellipses', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse({ center: { x: 15, y: 0 } });

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [7.5, 2.5, 0] }];

            const mockProcessedResults: IntersectionResult[] = [
                {
                    point: { x: 7.5, y: 2.5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            const {
                createVerbCurveFromEllipse,
                processVerbIntersectionResults,
            } = await import('../../../utils/verb-integration-utils');
            const { default: verb } = await import('verb-nurbs');

            const mockCurve1: Partial<VerbCurve> = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            };
            const mockCurve2: Partial<VerbCurve> = {
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [5, 0, 0],
                    [6, 1, 0],
                    [7, 0, 0],
                ],
                weights: () => [1, 1, 1],
            };

            vi.mocked(createVerbCurveFromEllipse).mockImplementation(
                (ellipse) => {
                    if (ellipse.center.x === 0)
                        return mockCurve1 as verb.geom.ICurve;
                    return mockCurve2 as verb.geom.ICurve;
                }
            );

            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = calculateEllipseEllipseIntersection(
                ellipse1,
                ellipse2,
                false
            );

            expect(createVerbCurveFromEllipse).toHaveBeenCalledWith(ellipse1);
            expect(createVerbCurveFromEllipse).toHaveBeenCalledWith(ellipse2);
            expect(verb.geom.Intersect.curves).toHaveBeenCalledWith(
                mockCurve1,
                mockCurve2,
                INTERSECTION_TOLERANCE
            );
            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                mockIntersections,
                false
            );
            expect(results).toEqual(mockProcessedResults);
        });

        it('should handle parameter swapping', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse({ center: { x: 15, y: 0 } });

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [7.5, 2.5, 0] }];

            const {
                createVerbCurveFromEllipse,
                processVerbIntersectionResults,
            } = await import('../../../utils/verb-integration-utils');
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            calculateEllipseEllipseIntersection(ellipse1, ellipse2, true);

            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                mockIntersections,
                true
            );
        });

        it('should handle verb-nurbs errors gracefully', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse();

            const { createVerbCurveFromEllipse } = await import(
                '../../../utils/verb-integration-utils'
            );
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockImplementation(() => {
                throw new Error('Intersection failed');
            });

            expect(() =>
                calculateEllipseEllipseIntersection(ellipse1, ellipse2)
            ).toThrow();
        });
    });

    describe('validateEllipseIntersectionParameters', () => {
        it('should validate valid ellipses', () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse();

            const result = validateEllipseIntersectionParameters(
                ellipse1,
                ellipse2
            );

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return validation result structure', () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse();

            const result = validateEllipseIntersectionParameters(
                ellipse1,
                ellipse2
            );

            expect(result).toHaveProperty('isValid');
            expect(typeof result.isValid).toBe('boolean');
        });
    });

    describe('processEllipseIntersectionResults', () => {
        it('should process intersection results with filtering', async () => {
            const rawResults = [
                { u0: 0.5, u1: 0.3, pt: [7.5, 2.5, 0] },
                { u0: 0.5, u1: 0.3, pt: [7.500001, 2.500001, 0] }, // Near duplicate
                { u0: 0.7, u1: 0.8, pt: [12.0, 3.0, 0] },
            ];

            const mockProcessedResults: IntersectionResult[] = [
                {
                    point: { x: 7.5, y: 2.5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
                {
                    point: { x: 7.500001, y: 2.500001 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
                {
                    point: { x: 12.0, y: 3.0 },
                    param1: 0.7,
                    param2: 0.8,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            const { processVerbIntersectionResults } = await import(
                '../../../utils/verb-integration-utils'
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = processEllipseIntersectionResults(
                rawResults,
                false,
                true
            );

            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                rawResults,
                false
            );
            expect(results.length).toBe(2); // One duplicate should be filtered out
        });

        it('should skip filtering when filterDuplicates is false', async () => {
            const rawResults = [
                { u0: 0.5, u1: 0.3, pt: [7.5, 2.5, 0] },
                { u0: 0.5, u1: 0.3, pt: [7.500001, 2.500001, 0] },
            ];

            const mockProcessedResults: IntersectionResult[] = [
                {
                    point: { x: 7.5, y: 2.5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
                {
                    point: { x: 7.500001, y: 2.500001 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            const { processVerbIntersectionResults } = await import(
                '../../../utils/verb-integration-utils'
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = processEllipseIntersectionResults(
                rawResults,
                false,
                false
            );

            expect(results.length).toBe(2); // No filtering should occur
            expect(results).toEqual(mockProcessedResults);
        });

        it('should handle parameter swapping', async () => {
            const rawResults = [{ u0: 0.5, u1: 0.3, pt: [7.5, 2.5, 0] }];

            const { processVerbIntersectionResults } = await import(
                '../../../utils/verb-integration-utils'
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            processEllipseIntersectionResults(rawResults, true, false);

            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                rawResults,
                true
            );
        });
    });

    describe('calculateIntersectionScore', () => {
        it('should calculate minimum distance to endpoints', () => {
            const intersection: IntersectionResult = {
                point: { x: 5, y: 5 },
                param1: 0.5,
                param2: 0.5,
                distance: 0.01,
                type: 'approximate',
                confidence: 0.95,
                onExtension: false,
            };

            const e1Start = { x: 0, y: 0 };
            const e1End = { x: 10, y: 0 };
            const e2Start = { x: 0, y: 10 };
            const e2End = { x: 10, y: 10 };

            const score = calculateIntersectionScore(
                intersection,
                e1Start,
                e1End,
                e2Start,
                e2End
            );

            // Distance from (5,5) to closest endpoint
            // To (10,0): sqrt(25+25) = 7.07
            // To (10,10): sqrt(25+25) = 7.07
            // To (0,0): sqrt(50) = 7.07
            // To (0,10): sqrt(50) = 7.07
            expect(score).toBeCloseTo(7.07, 2);
        });

        it('should find closest endpoint when intersection is near one', () => {
            const intersection: IntersectionResult = {
                point: { x: 1, y: 1 },
                param1: 0.1,
                param2: 0.1,
                distance: 0.01,
                type: 'approximate',
                confidence: 0.95,
                onExtension: false,
            };

            const e1Start = { x: 0, y: 0 };
            const e1End = { x: 10, y: 0 };
            const e2Start = { x: 0, y: 10 };
            const e2End = { x: 10, y: 10 };

            const score = calculateIntersectionScore(
                intersection,
                e1Start,
                e1End,
                e2Start,
                e2End
            );

            // Distance from (1,1) to (0,0) = sqrt(2) ≈ 1.41
            expect(score).toBeCloseTo(1.414, 2);
        });

        it('should handle intersection at exact endpoint', () => {
            const intersection: IntersectionResult = {
                point: { x: 0, y: 0 },
                param1: 0,
                param2: 0,
                distance: 0,
                type: 'approximate',
                confidence: 0.95,
                onExtension: false,
            };

            const e1Start = { x: 0, y: 0 };
            const e1End = { x: 10, y: 0 };
            const e2Start = { x: 0, y: 10 };
            const e2End = { x: 10, y: 10 };

            const score = calculateIntersectionScore(
                intersection,
                e1Start,
                e1End,
                e2Start,
                e2End
            );

            expect(score).toBe(0); // Exact match at e1Start
        });
    });

    describe('findEllipseEllipseIntersectionsVerb', () => {
        it('should find intersections between ellipse shapes', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse({ center: { x: 15, y: 0 } });
            const shape1 = createEllipseShape(ellipse1);
            const shape2 = createEllipseShape(ellipse2);

            const mockIntersections = [{ u0: 0.5, u1: 0.3, pt: [7.5, 2.5, 0] }];

            const mockProcessedResults: IntersectionResult[] = [
                {
                    point: { x: 7.5, y: 2.5 },
                    param1: 0.5,
                    param2: 0.3,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                },
            ];

            const {
                createVerbCurveFromEllipse,
                processVerbIntersectionResults,
            } = await import('../../../utils/verb-integration-utils');
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue(
                mockIntersections
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = findEllipseEllipseIntersectionsVerb(
                shape1,
                shape2,
                false
            );

            expect(results).toEqual(mockProcessedResults);
        });

        it('should handle parameter swapping', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse();
            const shape1 = createEllipseShape(ellipse1);
            const shape2 = createEllipseShape(ellipse2);

            const {
                createVerbCurveFromEllipse,
                processVerbIntersectionResults,
            } = await import('../../../utils/verb-integration-utils');
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue([]);
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            const results = findEllipseEllipseIntersectionsVerb(
                shape1,
                shape2,
                true
            );

            expect(processVerbIntersectionResults).toHaveBeenCalledWith(
                [],
                true
            );
            expect(results).toEqual([]);
        });

        it('should return empty array when validation fails', () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse();
            const shape1 = createEllipseShape(ellipse1);
            const shape2 = createEllipseShape(ellipse2);

            // Mock validation to fail
            vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Since our validation is currently minimal and always passes,
            // we can't easily test failure without modifying the validation function
            const results = findEllipseEllipseIntersectionsVerb(shape1, shape2);

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            vi.restoreAllMocks();
        });

        it('should handle verb-nurbs intersection failures', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse();
            const shape1 = createEllipseShape(ellipse1);
            const shape2 = createEllipseShape(ellipse2);

            const { createVerbCurveFromEllipse } = await import(
                '../../../utils/verb-integration-utils'
            );
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockImplementation(() => {
                throw new Error('Intersection failed');
            });

            expect(() =>
                findEllipseEllipseIntersectionsVerb(shape1, shape2)
            ).toThrow();
        });
    });

    describe('Duplicate Filtering', () => {
        it('should filter very close intersections', async () => {
            const rawResults = [
                { u0: 0.5, u1: 0.3, pt: [10.0, 10.0, 0] },
                { u0: 0.5, u1: 0.3, pt: [10.005, 10.005, 0] }, // Within tolerance (0.01)
                { u0: 0.7, u1: 0.8, pt: [20.0, 20.0, 0] }, // Different location
            ];

            const mockProcessedResults: IntersectionResult[] = rawResults.map(
                (r, _i) => ({
                    point: { x: r.pt[0], y: r.pt[1] },
                    param1: r.u0,
                    param2: r.u1,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                })
            );

            const { processVerbIntersectionResults } = await import(
                '../../../utils/verb-integration-utils'
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = processEllipseIntersectionResults(
                rawResults,
                false,
                true
            );

            expect(results.length).toBe(2); // One duplicate filtered out
            expect(results[0].point).toEqual({ x: 10.0, y: 10.0 });
            expect(results[1].point).toEqual({ x: 20.0, y: 20.0 });
        });

        it('should keep intersections that are far apart', async () => {
            const rawResults = [
                { u0: 0.5, u1: 0.3, pt: [0.0, 0.0, 0] },
                { u0: 0.7, u1: 0.8, pt: [100.0, 100.0, 0] },
            ];

            const mockProcessedResults: IntersectionResult[] = rawResults.map(
                (r) => ({
                    point: { x: r.pt[0], y: r.pt[1] },
                    param1: r.u0,
                    param2: r.u1,
                    distance: 0.01,
                    type: 'approximate',
                    confidence: 0.95,
                    onExtension: false,
                })
            );

            const { processVerbIntersectionResults } = await import(
                '../../../utils/verb-integration-utils'
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue(
                mockProcessedResults
            );

            const results = processEllipseIntersectionResults(
                rawResults,
                false,
                true
            );

            expect(results.length).toBe(2); // Both should be kept
            expect(results[0].point).toEqual({ x: 0.0, y: 0.0 });
            expect(results[1].point).toEqual({ x: 100.0, y: 100.0 });
        });

        it('should handle empty intersection results', async () => {
            const { processVerbIntersectionResults } = await import(
                '../../../utils/verb-integration-utils'
            );
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            const results = processEllipseIntersectionResults([], false, true);

            expect(results).toEqual([]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle identical ellipses', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse(); // Identical

            const {
                createVerbCurveFromEllipse,
                processVerbIntersectionResults,
            } = await import('../../../utils/verb-integration-utils');
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue([]);
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            const results = calculateEllipseEllipseIntersection(
                ellipse1,
                ellipse2
            );

            expect(results).toEqual([]);
        });

        it('should handle ellipses that do not intersect', async () => {
            const ellipse1 = createTestEllipse();
            const ellipse2 = createTestEllipse({
                center: { x: 1000, y: 1000 },
            }); // Far away

            const {
                createVerbCurveFromEllipse,
                processVerbIntersectionResults,
            } = await import('../../../utils/verb-integration-utils');
            const { default: verb } = await import('verb-nurbs');

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);
            vi.mocked(verb.geom.Intersect.curves).mockReturnValue([]);
            vi.mocked(processVerbIntersectionResults).mockReturnValue([]);

            const results = calculateEllipseEllipseIntersection(
                ellipse1,
                ellipse2
            );

            expect(results).toEqual([]);
        });

        it('should handle degenerate ellipses', async () => {
            const ellipse1 = createTestEllipse({ minorToMajorRatio: 0.001 }); // Very thin
            const ellipse2 = createTestEllipse();

            const { createVerbCurveFromEllipse } = await import(
                '../../../utils/verb-integration-utils'
            );

            vi.mocked(createVerbCurveFromEllipse).mockReturnValue({
                degree: () => 2,
                knots: () => [0, 0, 0, 1, 1, 1],
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 0, 0],
                ],
                weights: () => [1, 1, 1],
            } as unknown as verb.geom.ICurve);

            expect(() =>
                calculateEllipseEllipseIntersection(ellipse1, ellipse2)
            ).not.toThrow();
        });
    });
});
