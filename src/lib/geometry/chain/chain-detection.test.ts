import { GeometryType } from '$lib/geometry/shape/enums';
import { describe, expect, it } from 'vitest';
import { createPolylineFromVertices } from '$lib/geometry/polyline/functions';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { generateId } from '$lib/domain/id';
import { detectShapeChains } from './chain-detection';

describe('Chain Detection Algorithm', () => {
    // Helper function to create test shapes
    function createLine(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): ShapeData {
        return {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
            },
        };
    }

    function createCircle(
        centerX: number,
        centerY: number,
        radius: number
    ): ShapeData {
        return {
            id: generateId(),
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: centerX, y: centerY },
                radius,
            },
        };
    }

    function createArc(
        centerX: number,
        centerY: number,
        radius: number,
        startAngle: number,
        endAngle: number
    ): ShapeData {
        return {
            id: generateId(),
            type: GeometryType.ARC,
            geometry: {
                center: { x: centerX, y: centerY },
                radius,
                startAngle,
                endAngle,
                clockwise: false,
            },
        };
    }

    function createPolyline(
        points: Array<{ x: number; y: number }>,
        closed: boolean = false
    ): ShapeData {
        const polylineShape = createPolylineFromVertices(
            points.map((p) => ({ ...p, bulge: 0 })),
            closed
        );
        return polylineShape;
    }

    describe('Basic Chain Detection', () => {
        it('should detect chains for isolated shapes', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // Isolated line 1
                createLine(20, 0, 30, 0), // Isolated line 2
                createLine(40, 0, 50, 0), // Isolated line 3
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(3); // Each isolated shape forms its own chain
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[1].shapes).toHaveLength(1);
            expect(chains[2].shapes).toHaveLength(1);
        });

        it('should detect a simple chain of connected lines', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // Line 1: (0,0) -> (10,0)
                createLine(10, 0, 20, 0), // Line 2: (10,0) -> (20,0) - connects to Line 1
                createLine(20, 0, 30, 0), // Line 3: (20,0) -> (30,0) - connects to Line 2
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
            expect(chains[0].id).toMatch(/chain-\d+/);
        });

        it('should detect multiple separate chains', () => {
            const shapes: ShapeData[] = [
                // Chain 1: Connected lines
                createLine(0, 0, 10, 0),
                createLine(10, 0, 20, 0),

                // Chain 2: Connected lines (separate from chain 1)
                createLine(100, 0, 110, 0),
                createLine(110, 0, 120, 0),

                // Isolated shape (forms its own single-shape chain)
                createLine(200, 0, 210, 0),
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(3); // 2 multi-shape chains + 1 single-shape chain

            // Find chains by length
            const multiShapeChains = chains.filter(
                (chain) => chain.shapes.length === 2
            );
            const singleShapeChains = chains.filter(
                (chain) => chain.shapes.length === 1
            );

            expect(multiShapeChains).toHaveLength(2); // Two connected pairs
            expect(singleShapeChains).toHaveLength(1); // One isolated shape
        });
    });

    describe('Tolerance Testing', () => {
        it('should connect shapes within tolerance', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // End at (10, 0)
                createLine(10.04, 0, 20, 0), // Start at (10.04, 0) - within 0.05 tolerance
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(2);
        });

        it('should not connect shapes outside tolerance', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // End at (10, 0)
                createLine(10.06, 0, 20, 0), // Start at (10.06, 0) - outside 0.05 tolerance
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(2); // Two separate single-shape chains
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[1].shapes).toHaveLength(1);
        });

        it('should work with different tolerance values', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0),
                createLine(10.5, 0, 20, 0), // Gap of 0.5 units
            ];

            // Should not connect with small tolerance
            const chainsSmallTolerance = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            expect(chainsSmallTolerance).toHaveLength(2); // Two separate single-shape chains

            // Should connect with large tolerance
            const chainsLargeTolerance = detectShapeChains(shapes, {
                tolerance: 1.0,
            });
            expect(chainsLargeTolerance).toHaveLength(1);
            expect(chainsLargeTolerance[0].shapes).toHaveLength(2);
        });
    });

    describe('Mixed Shape Types', () => {
        it('should chain lines and circles', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // End at (10, 0)
                createCircle(10, 0, 5), // Center at (10, 0) - edge points include (10, 0)
                createLine(15, 0, 25, 0), // Start at (15, 0) - connects to circle edge
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
        });

        it('should chain lines and arcs', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // End at (10, 0)
                createArc(15, 0, 5, Math.PI, 0), // Arc center (15,0), radius 5 - start at (10,0), end at (20,0)
                createLine(20, 0, 30, 0), // Start at (20, 0) - connects to arc endpoint
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
        });

        it('should chain polylines with other shapes', () => {
            const shapes: ShapeData[] = [
                createPolyline([
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                ]),
                createLine(10, 10, 20, 10), // Connects to polyline endpoint
                createCircle(20, 10, 3), // Connects to line endpoint
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
        });
    });

    describe('Complex Chain Scenarios', () => {
        it('should handle branching chains (Y-shaped connections)', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // Main line
                createLine(10, 0, 20, 10), // Branch 1 from endpoint
                createLine(10, 0, 20, -10), // Branch 2 from same endpoint
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
        });

        it('should handle closed loops', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0), // Bottom edge
                createLine(10, 0, 10, 10), // Right edge
                createLine(10, 10, 0, 10), // Top edge
                createLine(0, 10, 0, 0), // Left edge - closes the loop
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(4);
        });

        it('should handle large chains with many shapes', () => {
            const shapes: ShapeData[] = [];

            // Create a zigzag pattern of connected lines
            for (let i: number = 0; i < 20; i++) {
                const startX = i * 10;
                const startY = i % 2 === 0 ? 0 : 10;
                const endX = (i + 1) * 10;
                const endY = i % 2 === 0 ? 10 : 0;

                shapes.push(createLine(startX, startY, endX, endY));
            }

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(20);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty shape array', () => {
            const chains = detectShapeChains([], { tolerance: 0.05 });
            expect(chains).toHaveLength(0);
        });

        it('should handle single shape', () => {
            const shapes = [createLine(0, 0, 10, 0)];
            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1); // Single shapes form chains too
            expect(chains[0].shapes).toHaveLength(1);
        });

        it('should handle zero tolerance', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0),
                createLine(10, 0, 20, 0), // Exact connection
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(2);
        });

        it('should handle very small tolerance', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0),
                createLine(10.001, 0, 20, 0), // Very small gap
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.0001 });
            expect(chains).toHaveLength(2); // Two separate single-shape chains

            const chainsLarger = detectShapeChains(shapes, { tolerance: 0.01 });
            expect(chainsLarger).toHaveLength(1); // Should connect
        });

        it('should handle shapes with identical points', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0),
                createLine(0, 0, 0, 10), // Shares start point with first line
                createLine(10, 0, 10, 10), // Shares end point with first line
            ];

            const chains = detectShapeChains(shapes, { tolerance: 0.05 });
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(3);
        });
    });

    describe('Closed Polylines with Bulges', () => {
        it('should correctly detect 2 separate closed polylines with bulges as 2 chains', () => {
            // Create first closed polyline with bulges - a rounded square
            const polyline1Shape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0.5 }, // Arc to next vertex
                    { x: 10, y: 0, bulge: 0.5 }, // Arc to next vertex
                    { x: 10, y: 10, bulge: 0.5 }, // Arc to next vertex
                    { x: 0, y: 10, bulge: 0.5 }, // Arc back to start
                ],
                true
            );

            const polyline1: ShapeData = {
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: polyline1Shape,
            } as unknown as ShapeData;

            // Create second closed polyline with bulges - a rounded triangle, separate from the first
            const polyline2Shape = createPolylineFromVertices(
                [
                    { x: 20, y: 0, bulge: 1.0 }, // Strong arc to next vertex
                    { x: 30, y: 0, bulge: -0.5 }, // Reverse arc to next vertex
                    { x: 25, y: 10, bulge: 0.5 }, // Arc back to start
                ],
                true
            );

            const polyline2: ShapeData = {
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: polyline2Shape,
            } as unknown as ShapeData;

            const shapes: ShapeData[] = [polyline1, polyline2];
            const chains = detectShapeChains(shapes, { tolerance: 0.05 });

            // Should detect 2 separate chains since the polylines don't touch
            expect(chains).toHaveLength(2);
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[1].shapes).toHaveLength(1);

            // Verify each chain contains one polyline
            expect(chains[0].shapes[0].type).toBe('polyline');
            expect(chains[1].shapes[0].type).toBe('polyline');
        });

        it('should detect 2 closed polylines with bulges as separate chains when they do not share points', () => {
            // Create first closed polyline with bulges - a rounded square
            const polyline1Shape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0.5 },
                    { x: 10, y: 0, bulge: 0.5 },
                    { x: 10, y: 10, bulge: 0.5 },
                    { x: 0, y: 10, bulge: 0.5 },
                ],
                true
            );

            const polyline1: ShapeData = {
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: polyline1Shape,
            } as unknown as ShapeData;

            // Create second closed polyline with bulges - adjacent but not overlapping
            // Note: With bulges, the actual arc endpoints may differ from vertex positions
            const polyline2Shape = createPolylineFromVertices(
                [
                    { x: 15, y: 0, bulge: -0.3 }, // Separated from first polyline
                    { x: 25, y: 0, bulge: 0.7 }, // Strong arc
                    { x: 25, y: 10, bulge: 0.3 },
                    { x: 15, y: 10, bulge: 0.3 },
                ],
                true
            );

            const polyline2: ShapeData = {
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: polyline2Shape,
            } as unknown as ShapeData;

            const shapes: ShapeData[] = [polyline1, polyline2];
            const chains = detectShapeChains(shapes, { tolerance: 0.05 });

            // Should detect 2 separate chains since polylines with bulges don't share points
            expect(chains).toHaveLength(2);
            expect(chains[0].shapes).toHaveLength(1);
            expect(chains[1].shapes).toHaveLength(1);

            // Verify each chain contains one polyline
            expect(chains[0].shapes[0].type).toBe('polyline');
            expect(chains[1].shapes[0].type).toBe('polyline');
        });
    });

    describe('Default Parameters', () => {
        it('should use default tolerance of 0.05 when not specified', () => {
            const shapes: ShapeData[] = [
                createLine(0, 0, 10, 0),
                createLine(10.04, 0, 20, 0), // Within default tolerance
            ];

            const chains = detectShapeChains(shapes); // No options provided
            expect(chains).toHaveLength(1);
            expect(chains[0].shapes).toHaveLength(2);
        });
    });
});
