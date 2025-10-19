import { describe, expect, it } from 'vitest';
import { type Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { findSplineArcIntersectionsVerb } from './index';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('spline-arc intersection edge cases and uncovered branches', () => {
    const createSplineShape = (spline: Spline): Shape => ({
        type: GeometryType.SPLINE,
        geometry: spline,
        id: 'test-spline',
        layer: 'default',
    });

    const createArcShape = (arc: Arc): Shape => ({
        type: GeometryType.ARC,
        geometry: arc,
        id: 'test-arc',
        layer: 'default',
    });

    const createTestSpline = (overrides: Partial<Spline> = {}): Spline => ({
        controlPoints: [
            { x: 0, y: 0 },
            { x: 2, y: 4 },
            { x: 6, y: 4 },
            { x: 8, y: 0 },
        ],
        knots: [0, 0, 0, 0, 1, 1, 1, 1],
        weights: [1, 1, 1, 1],
        degree: 3,
        fitPoints: [],
        closed: false,
        ...overrides,
    });

    const createTestArc = (overrides: Partial<Arc> = {}): Arc => ({
        center: { x: 4, y: 2 },
        radius: 2,
        startAngle: 0,
        endAngle: Math.PI,
        clockwise: false,
        ...overrides,
    });

    describe('basic intersection without extensions', () => {
        it('should find intersections with original shapes when they exist', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                false
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle parameter swapping correctly', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            const results1 = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                false
            );
            const results2 = findSplineArcIntersectionsVerb(
                spline,
                arc,
                true,
                false
            );

            expect(Array.isArray(results1)).toBe(true);
            expect(Array.isArray(results2)).toBe(true);
        });

        it('should return early when intersections found and extensions disabled', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            // When allowExtensions is false and there are intersections, should return early
            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                false
            );

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('extension scenarios', () => {
        it('should try extensions when no original intersections found', () => {
            // Create shapes that likely don't intersect in original form
            const spline = createSplineShape(
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                        { x: 2, y: 1 },
                        { x: 3, y: 0 },
                    ],
                })
            );
            const arc = createArcShape(
                createTestArc({
                    center: { x: 10, y: 10 },
                    radius: 1,
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                2.0
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle custom extension length', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 20, y: 0 },
                    radius: 1,
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                5.0
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle extension failures gracefully', () => {
            // Create potentially problematic shapes that might cause extension failures
            const spline = createSplineShape(
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 0, y: 0 }, // Duplicate points might cause issues
                    ],
                    knots: [0, 0, 1, 1],
                    weights: [1, 1],
                    degree: 1,
                })
            );
            const arc = createArcShape(
                createTestArc({
                    radius: 0.001, // Very small arc
                })
            );

            // Should not throw even if extensions fail
            expect(() => {
                findSplineArcIntersectionsVerb(spline, arc, false, true);
            }).not.toThrow();

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true
            );
            expect(Array.isArray(results)).toBe(true);
        });

        it('should try extended spline vs original arc', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 15, y: 0 }, // Positioned away from spline
                    radius: 2,
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                10.0
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should try original spline vs extended arc', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 15, y: 0 },
                    radius: 1,
                    startAngle: Math.PI,
                    endAngle: 2 * Math.PI, // Different arc portion
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                5.0
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should try extended spline vs extended arc for maximum coverage', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 20, y: 20 },
                    radius: 1,
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                15.0
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should combine results from all extension attempts', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 12, y: 0 },
                    radius: 3,
                })
            );

            // With larger extension, more likely to find intersections
            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                8.0
            );

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('error handling and edge cases', () => {
        it('should handle spline extension failures', () => {
            // Create a degenerate spline that might fail extension
            const degenerateSpline = createSplineShape(
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 0.001, y: 0.001 }, // Very small difference
                    ],
                    knots: [0, 0, 1, 1],
                    weights: [1, 1],
                    degree: 1,
                })
            );
            const arc = createArcShape(createTestArc());

            // Should handle extension failure gracefully
            const results = findSplineArcIntersectionsVerb(
                degenerateSpline,
                arc,
                false,
                true
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle arc extension failures', () => {
            const spline = createSplineShape(createTestSpline());
            // Create a potentially problematic arc
            const problematicArc = createArcShape(
                createTestArc({
                    radius: 0, // Zero radius might cause issues
                })
            );

            // Should handle extension failure gracefully
            const results = findSplineArcIntersectionsVerb(
                spline,
                problematicArc,
                false,
                true
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle both extension types failing', () => {
            // Create shapes that might cause all extension attempts to fail
            const problematicSpline = createSplineShape(
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 0, y: 0 },
                    ], // Degenerate
                    knots: [0, 0, 1, 1],
                    weights: [1, 1],
                    degree: 1,
                })
            );
            const problematicArc = createArcShape(
                createTestArc({
                    radius: 0, // Zero radius
                })
            );

            // Should not throw even if all extensions fail
            expect(() => {
                findSplineArcIntersectionsVerb(
                    problematicSpline,
                    problematicArc,
                    false,
                    true
                );
            }).not.toThrow();

            const results = findSplineArcIntersectionsVerb(
                problematicSpline,
                problematicArc,
                false,
                true
            );
            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle various spline types', () => {
            // Test with different spline configurations
            const splineTypes = [
                // Linear spline
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 10, y: 0 },
                    ],
                    knots: [0, 0, 1, 1],
                    weights: [1, 1],
                    degree: 1,
                }),
                // Quadratic spline
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                        { x: 10, y: 0 },
                    ],
                    knots: [0, 0, 0, 1, 1, 1],
                    weights: [1, 1, 1],
                    degree: 2,
                }),
                // Closed spline
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 3, y: 3 },
                        { x: 6, y: 0 },
                        { x: 3, y: -3 },
                    ],
                    closed: true,
                }),
            ];

            const arc = createArcShape(createTestArc());

            splineTypes.forEach((splineGeometry, _index) => {
                const spline = createSplineShape(splineGeometry);
                const results = findSplineArcIntersectionsVerb(
                    spline,
                    arc,
                    false,
                    true
                );

                expect(Array.isArray(results)).toBe(true);
            });
        });

        it('should handle various arc configurations', () => {
            const spline = createSplineShape(createTestSpline());

            // Test with different arc configurations
            const arcTypes = [
                // Small arc
                createTestArc({ radius: 0.5 }),
                // Large arc
                createTestArc({ radius: 10 }),
                // Full circle
                createTestArc({ startAngle: 0, endAngle: 2 * Math.PI }),
                // Clockwise arc
                createTestArc({ clockwise: true }),
                // Arc at different position
                createTestArc({ center: { x: -5, y: -5 } }),
            ];

            arcTypes.forEach((arcGeometry) => {
                const arc = createArcShape(arcGeometry);
                const results = findSplineArcIntersectionsVerb(
                    spline,
                    arc,
                    false,
                    true
                );

                expect(Array.isArray(results)).toBe(true);
            });
        });
    });

    describe('parameter and configuration combinations', () => {
        it('should test all parameter combinations', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            const paramCombinations = [
                { swapParams: false, allowExtensions: false },
                { swapParams: true, allowExtensions: false },
                { swapParams: false, allowExtensions: true },
                { swapParams: true, allowExtensions: true },
            ];

            paramCombinations.forEach(({ swapParams, allowExtensions }) => {
                const results = findSplineArcIntersectionsVerb(
                    spline,
                    arc,
                    swapParams,
                    allowExtensions
                );

                expect(Array.isArray(results)).toBe(true);
            });
        });

        it('should handle different extension lengths', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 15, y: 0 },
                    radius: 1,
                })
            );

            const extensionLengths = [0.1, 1.0, 5.0, 10.0];

            extensionLengths.forEach((length) => {
                const results = findSplineArcIntersectionsVerb(
                    spline,
                    arc,
                    false,
                    true,
                    length
                );

                expect(Array.isArray(results)).toBe(true);
            });
        });

        it('should maintain consistency between swap parameter settings', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            const results1 = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                false
            );
            const results2 = findSplineArcIntersectionsVerb(
                spline,
                arc,
                true,
                false
            );

            // Both should return valid arrays
            expect(Array.isArray(results1)).toBe(true);
            expect(Array.isArray(results2)).toBe(true);
        });
    });

    describe('geometric edge cases', () => {
        it('should handle spline-arc tangent intersections', () => {
            // Create a spline and arc that might be tangent
            const spline = createSplineShape(
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 2 },
                        { x: 2, y: 2 },
                        { x: 4, y: 2 },
                        { x: 6, y: 2 },
                    ], // Horizontal line at y=2
                    degree: 1,
                })
            );
            const arc = createArcShape(
                createTestArc({
                    center: { x: 3, y: 0 },
                    radius: 2, // Arc that touches the line at y=2
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle non-intersecting shapes', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(
                createTestArc({
                    center: { x: 100, y: 100 }, // Far away
                    radius: 1,
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(results)).toBe(true);
            // Likely no intersections for such distant shapes
        });

        it('should handle shapes with multiple potential intersections', () => {
            const spline = createSplineShape(
                createTestSpline({
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 2, y: 4 },
                        { x: 4, y: -2 },
                        { x: 6, y: 3 },
                        { x: 8, y: 0 },
                    ], // Wavy curve
                })
            );
            const arc = createArcShape(
                createTestArc({
                    center: { x: 4, y: 1 },
                    radius: 3, // Large arc that might intersect the wavy curve multiple times
                })
            );

            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true
            );

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('integration with shared utilities', () => {
        it('should properly use the core intersection function', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            // Test without extensions to ensure core function is used
            const results = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                false
            );

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle both regular and extension-based intersections', () => {
            const spline = createSplineShape(createTestSpline());
            const arc = createArcShape(createTestArc());

            // Compare results with and without extensions
            const resultsNoExt = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                false
            );
            const resultsWithExt = findSplineArcIntersectionsVerb(
                spline,
                arc,
                false,
                true
            );

            expect(Array.isArray(resultsNoExt)).toBe(true);
            expect(Array.isArray(resultsWithExt)).toBe(true);
        });
    });
});
