import { describe, expect, it } from 'vitest';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { isChainContainedInChain_Geometric } from '$lib/cam/chain/chain-containment';
import { Chain } from '$lib/cam/chain/classes.svelte';

// Helper function to create ellipse shapes for testing
function createEllipseShape(
    center: { x: number; y: number },
    majorAxisEndpoint: { x: number; y: number },
    minorToMajorRatio: number,
    startParam?: number,
    endParam?: number
): ShapeData {
    const geometry: Ellipse = {
        center,
        majorAxisEndpoint,
        minorToMajorRatio,
        ...(startParam !== undefined && { startParam }),
        ...(endParam !== undefined && { endParam }),
    };

    return {
        id: 'test-ellipse-' + Math.random(),
        type: GeometryType.ELLIPSE as GeometryType,
        geometry,
    };
}

// Helper function to create a chain from shapes
function createChain(
    shapes: ShapeData[],
    id: string = 'test-chain'
): ChainData {
    return {
        id,
        name: id,
        shapes,
    };
}

describe('Geometric Operations - Ellipse support', () => {
    describe('Ellipse polygon approximation', () => {
        it('should generate polygon points for a full ellipse', () => {
            const ellipse: ShapeData = createEllipseShape(
                { x: 0, y: 0 },
                { x: 10, y: 0 }, // Horizontal major axis
                0.5 // Minor axis is half of major
            );

            const chain = createChain([ellipse]);

            // This will internally call getShapePoints which should generate polygon approximation
            // We test this indirectly through containment operations
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });

        it('should generate polygon points for an ellipse arc', () => {
            const ellipse: ShapeData = createEllipseShape(
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                0.6,
                0, // Start at 0 radians
                Math.PI // End at π radians (semicircle)
            );

            const chain = createChain([ellipse]);

            // Test that polygon approximation works for arcs
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });

        it('should handle rotated ellipse correctly', () => {
            const ellipse: ShapeData = createEllipseShape(
                { x: 50, y: 50 },
                { x: 0, y: 15 }, // Vertical major axis
                0.8
            );

            const chain = createChain([ellipse]);

            // Test polygon generation for rotated ellipse
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });
    });

    describe('Ellipse containment detection', () => {
        it('should detect when a small ellipse is contained within a larger ellipse', () => {
            const outerEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 50, y: 0 },
                0.6
            );

            const innerEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                0.6
            );

            const outerChain = createChain([outerEllipse], 'outer');
            const innerChain = createChain([innerEllipse], 'inner');

            const isContained = isChainContainedInChain_Geometric(
                new Chain(innerChain),
                new Chain(outerChain)
            );
            expect(isContained).toBe(true);
        });

        it('should detect when ellipses do not contain each other', () => {
            const ellipse1 = createEllipseShape(
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.5
            );

            const ellipse2 = createEllipseShape(
                { x: 100, y: 100 },
                { x: 30, y: 0 },
                0.5
            );

            const chain1 = createChain([ellipse1], 'chain1');
            const chain2 = createChain([ellipse2], 'chain2');

            const isContained1 = isChainContainedInChain_Geometric(
                new Chain(chain1),
                new Chain(chain2)
            );
            const isContained2 = isChainContainedInChain_Geometric(
                new Chain(chain2),
                new Chain(chain1)
            );

            expect(isContained1).toBe(false);
            expect(isContained2).toBe(false);
        });

        it('should handle ellipse arc containment', () => {
            const fullEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 40, y: 0 },
                0.7
            );

            const ellipseArc = createEllipseShape(
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                0.7,
                0,
                Math.PI
            );

            const fullChain = createChain([fullEllipse], 'full');
            const arcChain = createChain([ellipseArc], 'arc');

            // Arc should be contained within full ellipse
            const isContained = isChainContainedInChain_Geometric(
                new Chain(arcChain),
                new Chain(fullChain)
            );
            expect(isContained).toBe(true);
        });
    });

    describe('Mixed geometry containment with ellipses', () => {
        it('should handle containment between ellipse and other shapes', () => {
            // Create a large ellipse
            const ellipse: ShapeData = createEllipseShape(
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                0.8
            );

            // Create a small circle that should be contained
            const circle: ShapeData = {
                id: 'test-circle',
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 20,
                },
            };

            const ellipseChain = createChain([ellipse], 'ellipse');
            const circleChain = createChain([circle], 'circle');

            const isContained = isChainContainedInChain_Geometric(
                new Chain(circleChain),
                new Chain(ellipseChain)
            );
            expect(isContained).toBe(true);
        });

        it('should handle ellipse contained within rectangular boundary', () => {
            // Create a rectangle using lines
            const rectLines: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -60, y: -40 },
                        end: { x: 60, y: -40 },
                    },
                },
                {
                    id: 'line2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 60, y: -40 },
                        end: { x: 60, y: 40 },
                    },
                },
                {
                    id: 'line3',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 60, y: 40 },
                        end: { x: -60, y: 40 },
                    },
                },
                {
                    id: 'line4',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -60, y: 40 },
                        end: { x: -60, y: -40 },
                    },
                },
            ];

            // Create ellipse that fits within rectangle
            const ellipse: ShapeData = createEllipseShape(
                { x: 0, y: 0 },
                { x: 40, y: 0 },
                0.75
            );

            const rectChain = createChain(rectLines, 'rectangle');
            const ellipseChain = createChain([ellipse], 'ellipse');

            const isContained = isChainContainedInChain_Geometric(
                new Chain(ellipseChain),
                new Chain(rectChain)
            );
            expect(isContained).toBe(true);
        });
    });

    describe('Ellipse polygon quality', () => {
        it('should generate sufficient points for accurate containment testing', () => {
            const ellipse: ShapeData = createEllipseShape(
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.5
            );

            // Extract polygon points manually to test quality
            const chain = createChain([ellipse]);

            // The polygon should be detailed enough for accurate point-in-polygon tests
            // This is tested implicitly through containment operations
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });

        it('should handle very flat ellipses correctly', () => {
            const flatEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                0.05 // Very flat ellipse
            );

            const chain = createChain([flatEllipse]);

            // Should not throw even with very flat ellipse
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });

        it('should handle circular ellipses (ratio = 1.0)', () => {
            const circularEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 25, y: 0 },
                1.0 // Perfect circle
            );

            const chain = createChain([circularEllipse]);

            // Should behave like a circle
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });
    });

    describe('Error handling', () => {
        it('should handle degenerate ellipse gracefully', () => {
            const degenerateEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 0, y: 0 }, // Zero-length major axis
                0.5
            );

            const chain = createChain([degenerateEllipse]);

            // For degenerate ellipses, the polygon extraction may fail
            // This is expected behavior - we should get an error about failed polygon extraction
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).toThrow(/Failed to extract polygons/);
        });

        it('should handle ellipse with invalid ratio', () => {
            const invalidEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0 // Invalid ratio
            );

            const chain = createChain([invalidEllipse]);

            // Should handle gracefully
            expect(() => {
                isChainContainedInChain_Geometric(
                    new Chain(chain),
                    new Chain(chain)
                );
            }).not.toThrow();
        });
    });
});
