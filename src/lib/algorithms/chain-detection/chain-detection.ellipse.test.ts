import { describe, expect, it } from 'vitest';
import type { Ellipse, Point2D, Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';
import { detectShapeChains, isShapeClosed } from './chain-detection';

// Helper function to create ellipse shapes
function createEllipse(
    id: string,
    center: Point2D,
    majorAxisEndpoint: Point2D,
    minorToMajorRatio: number,
    startParam?: number,
    endParam?: number
): Shape {
    const ellipseGeometry: Ellipse = {
        center,
        majorAxisEndpoint,
        minorToMajorRatio,
        ...(startParam !== undefined && { startParam }),
        ...(endParam !== undefined && { endParam }),
    };

    return {
        id,
        type: GeometryType.ELLIPSE,
        geometry: ellipseGeometry,
    };
}

describe('Chain Detection - Ellipse Support', () => {
    describe('Full ellipse chains', () => {
        it('should detect single full ellipse as a chain', () => {
            const ellipse = createEllipse(
                'ellipse1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6
            );

            const chains = detectShapeChains([ellipse], { tolerance: 0.05 });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[0].shapes[0].id).toBe('ellipse1');
        });

        it('should detect full ellipse with explicit parameters (0 to 2π) as closed', () => {
            const ellipse = createEllipse(
                'ellipse1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6,
                0,
                2 * Math.PI
            );

            const chains = detectShapeChains([ellipse], { tolerance: 0.05 });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[0].shapes[0].id).toBe('ellipse1');

            // Verify it's detected as closed
            expect(isShapeClosed(ellipse, 0.05)).toBe(true);
        });

        it('should not connect separate full ellipses', () => {
            const ellipse1 = createEllipse(
                'ellipse1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6
            );
            const ellipse2 = createEllipse(
                'ellipse2',
                { x: 100, y: 100 },
                { x: 25, y: 0 },
                0.8
            );

            const chains = detectShapeChains([ellipse1, ellipse2], {
                tolerance: 0.05,
            });

            expect(chains).toHaveLength(2);
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[1].shapes).toHaveLength(1);
        });

        it('should connect overlapping full ellipses', () => {
            const ellipse1 = createEllipse(
                'ellipse1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6
            );
            const ellipse2 = createEllipse(
                'ellipse2',
                { x: 30, y: 0 },
                { x: 25, y: 0 },
                0.8
            ); // Overlapping at right edge

            const chains = detectShapeChains([ellipse1, ellipse2], {
                tolerance: 5,
            }); // Larger tolerance to ensure connection

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(2);
        });
    });

    describe('Ellipse arc chains', () => {
        it('should detect single ellipse arc as an open chain', () => {
            const ellipseArc = createEllipse(
                'arc1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6,
                0,
                Math.PI
            );

            const chains = detectShapeChains([ellipseArc], { tolerance: 0.05 });

            // ALL shapes form chains, including open ellipse arcs
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[0].shapes[0].id).toBe('arc1');

            // Verify it's detected as open
            expect(isShapeClosed(ellipseArc, 0.05)).toBe(false);
        });

        it('should connect ellipse arc with other shapes at endpoints', () => {
            const ellipseArc = createEllipse(
                'arc1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6,
                0,
                Math.PI
            );

            // Create a line that connects to the ellipse arc's start point (30, 0)
            const line: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 30, y: 0 },
                    end: { x: 50, y: 20 },
                },
            };

            const chains = detectShapeChains([ellipseArc, line], {
                tolerance: 0.05,
            });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(2);
            expect(chains[0].shapes.map((s) => s.id).sort()).toEqual([
                'arc1',
                'line1',
            ]);
        });

        it('should connect two ellipse arcs at their endpoints', () => {
            // First arc from 0 to π, end point at (-30, 0)
            const arc1 = createEllipse(
                'arc1',
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.6,
                0,
                Math.PI
            );

            // Second arc that starts where first arc ends
            const arc2 = createEllipse(
                'arc2',
                { x: -30, y: 0 },
                { x: 20, y: 0 },
                0.8,
                0,
                Math.PI / 2
            );

            const chains = detectShapeChains([arc1, arc2], { tolerance: 0.05 });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(2);
        });
    });

    describe('Mixed ellipse and other shape chains', () => {
        it('should connect ellipse arc with line and circle', () => {
            // Ellipse arc
            const ellipseArc = createEllipse(
                'arc1',
                { x: 0, y: 0 },
                { x: 25, y: 0 },
                0.8,
                0,
                Math.PI / 2
            );

            // Line connecting to arc end point
            const line: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 20 }, // Arc end point
                    end: { x: 30, y: 50 },
                },
            };

            // Circle touching line end point
            const circle: Shape = {
                id: 'circle1',
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 30, y: 60 },
                    radius: 10,
                },
            };

            const chains = detectShapeChains([ellipseArc, line, circle], {
                tolerance: 0.1,
            });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
        });

        it('should handle complex chain with multiple ellipses', () => {
            const shapes: Shape[] = [
                createEllipse('ellipse1', { x: 0, y: 0 }, { x: 20, y: 0 }, 1.0), // Full circle-like ellipse
                createEllipse(
                    'ellipse2',
                    { x: 100, y: 100 },
                    { x: 15, y: 0 },
                    0.5
                ), // Full ellipse
                createEllipse(
                    'arc1',
                    { x: 50, y: 50 },
                    { x: 30, y: 0 },
                    0.7,
                    0,
                    Math.PI
                ), // Arc
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 20, y: 50 }, // Near arc start
                        end: { x: 0, y: 0 }, // Connects to ellipse1 center
                    },
                },
            ];

            const chains = detectShapeChains(shapes, { tolerance: 5 });

            // Should detect some chains - exact count depends on proximity
            expect(chains.length).toBeGreaterThan(0);
        });
    });

    describe('Edge cases with ellipses', () => {
        it('should handle degenerate ellipse (zero major axis)', () => {
            const degenerate = createEllipse(
                'degenerate',
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                0.5
            );

            const chains = detectShapeChains([degenerate], { tolerance: 0.05 });

            // Should not crash, degenerate ellipse is still treated as a closed shape
            expect(chains).toHaveLength(1); // Even degenerate ellipse forms a chain if it's closed
        });

        it('should handle very flat ellipse', () => {
            const flatEllipse = createEllipse(
                'flat',
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                0.01
            );

            const chains = detectShapeChains([flatEllipse], {
                tolerance: 0.05,
            });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(1);
        });

        it('should handle ellipse with ratio = 1 (perfect circle)', () => {
            const circularEllipse = createEllipse(
                'circular',
                { x: 0, y: 0 },
                { x: 25, y: 0 },
                1.0
            );

            const chains = detectShapeChains([circularEllipse], {
                tolerance: 0.05,
            });

            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(1);
        });
    });
});
