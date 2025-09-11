import { describe, it, expect, vi, beforeEach } from 'vitest';
import { offsetEllipse } from './ellipse';
import type { Ellipse } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import { generateUniformKnotVector } from '$lib/geometry/spline';
import { getEllipseParameters } from '$lib/geometry/ellipse';
import verb from 'verb-nurbs';
import { OffsetDirection } from '../types';

// Mock verb-nurbs for error testing
vi.mock('verb-nurbs', () => ({
    default: {
        geom: {
            NurbsCurve: {
                byPoints: vi.fn(),
            },
        },
    },
}));

// Mock ellipse utils
vi.mock('$lib/geometry/ellipse', () => ({
    getEllipseParameters: vi.fn(),
}));

// Mock chain constants
vi.mock('$lib/geometry/chain', () => ({
    POLYGON_POINTS_MIN: 3,
}));

// Mock NURBS utils
vi.mock('$lib/geometry/spline', () => ({
    generateUniformKnotVector: vi.fn((controlPointsCount, degree) => {
        // Generate a valid uniform knot vector
        const knotCount = controlPointsCount + degree + 1;
        const knots = [];

        // Repeat the first knot (degree + 1) times
        for (let i = 0; i <= degree; i++) {
            knots.push(0);
        }

        // Internal knots
        const internalKnotCount = knotCount - 2 * (degree + 1);
        for (let i = 1; i <= internalKnotCount; i++) {
            knots.push(i / (internalKnotCount + 1));
        }

        // Repeat the last knot (degree + 1) times
        for (let i = 0; i <= degree; i++) {
            knots.push(1);
        }

        return knots;
    }),
    DEFAULT_SPLINE_DEGREE: 3,
}));

describe('Ellipse Offset Edge Cases and Error Handling', () => {
    const createTestEllipse = (overrides: Partial<Ellipse> = {}): Ellipse => ({
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 10, y: 0 },
        minorToMajorRatio: 0.5,
        ...overrides,
    });

    describe('Edge Cases', () => {
        it('should handle ellipse with zero major axis length', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 0,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to offset ellipse');
        });

        it('should handle ellipse with zero minor axis length', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 0,
                majorAxisAngle: 0,
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to offset ellipse');
        });

        it('should handle degenerate ellipse (both axes zero)', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 0,
                minorAxisLength: 0,
                majorAxisAngle: 0,
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain(
                'Insufficient points generated for ellipse offset'
            );
        });

        it('should handle extremely small ellipse', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 1e-10,
                minorAxisLength: 1e-10,
                majorAxisAngle: 0,
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to offset ellipse');
        });

        it('should handle ellipse arc with invalid parameter range', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            const ellipse = createTestEllipse({
                startParam: Math.PI,
                endParam: Math.PI, // Same start and end - no range
            });

            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to offset ellipse');
        });

        it('should handle ellipse arc with reversed parameter range', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                ]),
                degree: vi.fn(() => 2),
                knots: vi.fn(() => [0, 0, 0, 1, 1, 1]),
                weights: vi.fn(() => [1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse({
                startParam: Math.PI,
                endParam: 0, // Reversed range
            });

            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            // Should still work but with negative parameter range
            expect(result.success).toBe(true);
        });

        it('should handle extremely large offset distance', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1000, 2000, 0],
                    [3000, 4000, 0],
                ]),
                degree: vi.fn(() => 1),
                knots: vi.fn(() => [0, 0, 1, 1]),
                weights: vi.fn(() => [1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 1,
                    knots: [0, 0, 1, 1],
                    controlPoints: [
                        [1000, 2000, 0],
                        [3000, 4000, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1e6, OffsetDirection.OUTSET); // Very large offset

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(1);
            expect(result.warnings).toContain(
                'Ellipse offset calculated using true mathematical offset and fitted to NURBS curve'
            );
        });

        it('should handle ellipse with extreme rotation angle', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 7 * Math.PI, // Multiple rotations
            });

            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                ]),
                degree: vi.fn(() => 2),
                knots: vi.fn(() => [0, 0, 0, 1, 1, 1]),
                weights: vi.fn(() => [1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(1);
        });

        it('should handle negative offset distance with outset direction', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                ]),
                degree: vi.fn(() => 2),
                knots: vi.fn(() => [0, 0, 0, 1, 1, 1]),
                weights: vi.fn(() => [1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, -5, OffsetDirection.OUTSET); // Negative distance

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle verb-nurbs curve fitting failure', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockImplementation(() => {
                throw new Error('Curve fitting failed');
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors).toContain(
                'Failed to fit NURBS curve to ellipse offset points: Curve fitting failed'
            );
        });

        it('should handle verb-nurbs curve fitting failure with non-Error exception', async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockImplementation(() => {
                throw 'String error in curve fitting';
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors).toContain(
                'Failed to fit NURBS curve to ellipse offset points: String error in curve fitting'
            );
        });

        it('should handle getEllipseParameters throwing an error', async () => {
            vi.mocked(getEllipseParameters).mockImplementation(() => {
                throw new Error('Invalid ellipse parameters');
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors).toContain(
                'Failed to offset ellipse: Invalid ellipse parameters'
            );
        });

        it('should handle getEllipseParameters throwing non-Error exception', async () => {
            vi.mocked(getEllipseParameters).mockImplementation(() => {
                throw 'Parameter extraction failed';
            });

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(false);
            expect(result.errors).toContain(
                'Failed to offset ellipse: Parameter extraction failed'
            );
        });

        it('should handle invalid knot vector and repair it', async () => {
            // Static imports moved to top of file

            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            // Mock a curve with invalid knot vector length
            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                    [7, 8, 0],
                ]),
                degree: vi.fn(() => 3),
                knots: vi.fn(() => [0, 0.5, 1]), // Wrong length - should be 8 for 4 control points + degree 3
                weights: vi.fn(() => [1, 1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 3,
                    knots: [0, 0.5, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                        [7, 8, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            const validKnots = [0, 0, 0, 0, 1, 1, 1, 1];
            vi.mocked(generateUniformKnotVector).mockReturnValue(validKnots);
            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            expect(generateUniformKnotVector).toHaveBeenCalledWith(4, 3);

            const splineGeometry = result.shapes[0].geometry as Spline;
            expect(splineGeometry.knots).toEqual(validKnots);
        });

        it('should handle malformed knot vector structure and repair it', async () => {
            // Static imports moved to top of file

            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            // Mock a curve with correct length but wrong structure (should have repeated end knots)
            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                    [7, 8, 0],
                ]),
                degree: vi.fn(() => 3),
                knots: vi.fn(() => [0, 0.1, 0.2, 0.3, 0.7, 0.8, 0.9, 1]), // Wrong structure - no repeated end knots
                weights: vi.fn(() => [1, 1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 3,
                    knots: [0, 0.1, 0.2, 0.3, 0.7, 0.8, 0.9, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                        [7, 8, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            const validKnots = [0, 0, 0, 0, 1, 1, 1, 1];
            vi.mocked(generateUniformKnotVector).mockReturnValue(validKnots);
            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            expect(generateUniformKnotVector).toHaveBeenCalledWith(4, 3);

            const splineGeometry = result.shapes[0].geometry as Spline;
            expect(splineGeometry.knots).toEqual(validKnots);
        });

        it('should preserve valid knot vector structure', async () => {
            // Static imports moved to top of file

            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            // Mock a curve with valid knot vector structure
            const validKnots = [0, 0, 0, 0, 1, 1, 1, 1];
            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                    [7, 8, 0],
                ]),
                degree: vi.fn(() => 3),
                knots: vi.fn(() => validKnots),
                weights: vi.fn(() => [1, 1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 3,
                    knots: validKnots,
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                        [7, 8, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            // Note: generateUniformKnotVector may be called even with valid knots
            // as part of the validation/repair process

            const splineGeometry = result.shapes[0].geometry as Spline;
            expect(splineGeometry.knots).toEqual(validKnots);
        });
    });

    describe('Direction and Distance Handling', () => {
        beforeEach(async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });

            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                ]),
                degree: vi.fn(() => 2),
                knots: vi.fn(() => [0, 0, 0, 1, 1, 1]),
                weights: vi.fn(() => [1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);
        });

        it('should return empty result for none direction', () => {
            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 5, OffsetDirection.NONE);

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should return empty result for zero distance', () => {
            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 0, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle inset direction correctly', () => {
            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 2, OffsetDirection.INSET);

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(1);
            expect(result.warnings).toContain(
                'Ellipse offset calculated using true mathematical offset and fitted to NURBS curve'
            );
        });

        it('should handle outset direction correctly', () => {
            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 2, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(1);
            expect(result.warnings).toContain(
                'Ellipse offset calculated using true mathematical offset and fitted to NURBS curve'
            );
        });
    });

    describe('Spline Properties', () => {
        beforeEach(async () => {
            vi.mocked(getEllipseParameters).mockReturnValue({
                majorAxisLength: 10,
                minorAxisLength: 5,
                majorAxisAngle: 0,
            });
        });

        it('should create closed spline for full ellipse', async () => {
            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                ]),
                degree: vi.fn(() => 2),
                knots: vi.fn(() => [0, 0, 0, 1, 1, 1]),
                weights: vi.fn(() => [1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse(); // Full ellipse (no startParam/endParam)
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            const splineGeometry = result.shapes[0].geometry as Spline;
            expect(splineGeometry.closed).toBe(true);
        });

        it('should create open spline for ellipse arc', async () => {
            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                    [5, 6, 0],
                ]),
                degree: vi.fn(() => 2),
                knots: vi.fn(() => [0, 0, 0, 1, 1, 1]),
                weights: vi.fn(() => [1, 1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                        [5, 6, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse({
                startParam: 0,
                endParam: Math.PI, // Half ellipse
            });
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            const splineGeometry = result.shapes[0].geometry as Spline;
            expect(splineGeometry.closed).toBe(false);
        });

        it('should create spline with proper properties', async () => {
            const controlPoints = [
                [1, 2, 0],
                [3, 4, 0],
                [5, 6, 0],
                [7, 8, 0],
            ];
            const degree = 3;
            const knots = [0, 0, 0, 0, 1, 1, 1, 1];
            const weights = [1, 1, 1, 1];

            const mockCurve = {
                controlPoints: vi.fn(() => controlPoints),
                degree: vi.fn(() => degree),
                knots: vi.fn(() => knots),
                weights: vi.fn(() => weights),
                asNurbs: vi.fn(() => ({ degree, knots, controlPoints })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            const splineGeometry = result.shapes[0].geometry as Spline;

            expect(splineGeometry.controlPoints).toHaveLength(4);
            expect(splineGeometry.controlPoints[0]).toEqual({ x: 1, y: 2 });
            expect(splineGeometry.controlPoints[1]).toEqual({ x: 3, y: 4 });
            expect(splineGeometry.degree).toBe(degree);
            expect(splineGeometry.knots).toEqual(knots);
            expect(splineGeometry.weights).toEqual(weights);
            expect(splineGeometry.fitPoints).toEqual([]);
        });

        it('should generate reasonable shape id', async () => {
            const mockCurve = {
                controlPoints: vi.fn(() => [
                    [1, 2, 0],
                    [3, 4, 0],
                ]),
                degree: vi.fn(() => 1),
                knots: vi.fn(() => [0, 0, 1, 1]),
                weights: vi.fn(() => [1, 1]),
                asNurbs: vi.fn(() => ({
                    degree: 1,
                    knots: [0, 0, 1, 1],
                    controlPoints: [
                        [1, 2, 0],
                        [3, 4, 0],
                    ],
                })),
                clone: vi.fn(),
                domain: vi.fn(() => ({ min: 0, max: 1 })),
                transform: vi.fn(),
                transformAsync: vi.fn(),
                point: vi.fn(() => [0, 0, 0]),
                pointAsync: vi.fn(() => Promise.resolve([0, 0, 0])),
                tangent: vi.fn(() => [1, 0, 0]),
                tangentAsync: vi.fn(() => Promise.resolve([1, 0, 0])),
                derivatives: vi.fn(() => [
                    [0, 0, 0],
                    [1, 0, 0],
                ]),
                derivativesAsync: vi.fn(() =>
                    Promise.resolve([
                        [0, 0, 0],
                        [1, 0, 0],
                    ])
                ),
                closestPoint: vi.fn(() => ({ u: 0, pt: [0, 0, 0], d: 0 })),
                closestPointAsync: vi.fn(() =>
                    Promise.resolve({ u: 0, pt: [0, 0, 0], d: 0 })
                ),
                closestParam: vi.fn(() => 0),
                closestParamAsync: vi.fn(() => Promise.resolve(0)),
                length: vi.fn(() => 1),
                lengthAsync: vi.fn(() => Promise.resolve(1)),
                lengthAtParam: vi.fn(() => 1),
                lengthAtParamAsync: vi.fn(() => Promise.resolve(1)),
                paramAtLength: vi.fn(() => 0),
                paramAtLengthAsync: vi.fn(() => Promise.resolve(0)),
                divideByEqualArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByEqualArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                divideByArcLength: vi.fn(() => [[0, 0, 0]]),
                divideByArcLengthAsync: vi.fn(() =>
                    Promise.resolve([[0, 0, 0]])
                ),
                split: vi.fn(() => []),
                splitAsync: vi.fn(() => Promise.resolve([])),
                reverse: vi.fn(),
                reverseAsync: vi.fn(),
                tessellate: vi.fn(() => [[0, 0, 0]]),
                tessellateAsync: vi.fn(() => Promise.resolve([[0, 0, 0]])),
            };

            vi.mocked(verb.geom.NurbsCurve.byPoints).mockReturnValue(mockCurve);

            const ellipse = createTestEllipse();
            const result = offsetEllipse(ellipse, 1, OffsetDirection.OUTSET);

            expect(result.success).toBe(true);
            expect(result.shapes[0].id).toMatch(/^offset_[a-z0-9]{9}$/);
            expect(result.shapes[0].type).toBe('spline');
        });
    });
});
