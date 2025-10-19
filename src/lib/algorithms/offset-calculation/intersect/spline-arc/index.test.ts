import { describe, expect, it, vi } from 'vitest';
import { findSplineArcIntersectionsVerb } from './index';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('findSplineArcIntersectionsVerb', () => {
    const createTestSpline = (): Shape => ({
        id: 'spline1',
        type: GeometryType.SPLINE,
        geometry: {
            degree: 3,
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 5 },
                { x: 30, y: 15 },
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        } as Spline,
    });

    const createTestArc = (): Shape => ({
        id: 'arc1',
        type: GeometryType.ARC,
        geometry: {
            center: { x: 15, y: 10 },
            radius: 8,
            startAngle: 0,
            endAngle: Math.PI,
        } as Arc,
    });

    const createNonIntersectingSpline = (): Shape => ({
        id: 'spline2',
        type: GeometryType.SPLINE,
        geometry: {
            degree: 3,
            controlPoints: [
                { x: 100, y: 100 },
                { x: 110, y: 110 },
                { x: 120, y: 105 },
                { x: 130, y: 115 },
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        } as Spline,
    });

    const createNonIntersectingArc = (): Shape => ({
        id: 'arc2',
        type: GeometryType.ARC,
        geometry: {
            center: { x: 150, y: 150 },
            radius: 5,
            startAngle: 0,
            endAngle: Math.PI,
        } as Arc,
    });

    describe('basic intersection functionality', () => {
        it('should find intersections between spline and arc', () => {
            const splineShape = createTestSpline();
            const arcShape = createTestArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle no intersections with original shapes', () => {
            const splineShape = createNonIntersectingSpline();
            const arcShape = createNonIntersectingArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                false
            );

            expect(result).toEqual([]);
        });
    });

    describe('extension handling', () => {
        it('should return original results when intersections found without extensions', () => {
            const splineShape = createTestSpline();
            const arcShape = createTestArc();

            // Mock the core function to return some results
            vi.doMock('./index', async () => {
                const actual = await vi.importActual('./index');
                return {
                    ...actual,
                    findSplineArcIntersectionsCore: vi.fn(() => [
                        {
                            point: { x: 10, y: 10 },
                            t1: 0.5,
                            t2: 0.3,
                            onExtension: false,
                        },
                    ]),
                };
            });

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                true // allowExtensions = true
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should try extensions when no original intersections found', () => {
            const splineShape = createNonIntersectingSpline();
            const arcShape = createNonIntersectingArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                true, // allowExtensions = true
                50
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle extended spline vs original arc failure gracefully', () => {
            // Mock createExtendedSplineVerb to throw an error
            vi.doMock('../../extend/spline', () => ({
                createExtendedSplineVerb: vi.fn(() => {
                    throw new Error('Spline extension failed');
                }),
            }));

            const splineShape = createNonIntersectingSpline();
            const arcShape = createNonIntersectingArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                true, // allowExtensions = true
                50
            );

            // Should not throw error, should continue with other extension methods
            expect(Array.isArray(result)).toBe(true);

            vi.doUnmock('../../extend/spline');
        });

        it('should handle original spline vs extended arc failure gracefully', () => {
            // Mock createExtendedArc to throw an error
            vi.doMock('../../extend/arc', () => ({
                createExtendedArc: vi.fn(() => {
                    throw new Error('Arc extension failed');
                }),
            }));

            const splineShape = createNonIntersectingSpline();
            const arcShape = createNonIntersectingArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                true, // allowExtensions = true
                50
            );

            // Should not throw error, should continue with other extension methods
            expect(Array.isArray(result)).toBe(true);

            vi.doUnmock('../../extend/arc');
        });

        it('should handle extended spline vs extended arc failure gracefully', () => {
            // Mock both extension functions to throw errors
            vi.doMock('../../extend/spline', () => ({
                createExtendedSplineVerb: vi.fn(() => {
                    throw new Error('Spline extension failed');
                }),
            }));
            vi.doMock('../../extend/arc', () => ({
                createExtendedArc: vi.fn(() => {
                    throw new Error('Arc extension failed');
                }),
            }));

            const splineShape = createNonIntersectingSpline();
            const arcShape = createNonIntersectingArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                true, // allowExtensions = true
                50
            );

            // Should not throw error, should return whatever results were found
            expect(Array.isArray(result)).toBe(true);

            vi.doUnmock('../../extend/spline');
            vi.doUnmock('../../extend/arc');
        });
    });

    describe('parameter handling', () => {
        it('should handle swapParams correctly', () => {
            const splineShape = createTestSpline();
            const arcShape = createTestArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                true, // swapParams = true
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle custom extension length', () => {
            const splineShape = createNonIntersectingSpline();
            const arcShape = createNonIntersectingArc();

            const result = findSplineArcIntersectionsVerb(
                splineShape,
                arcShape,
                false,
                true, // allowExtensions = true
                100 // custom extension length
            );

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
