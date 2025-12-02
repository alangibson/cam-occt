import { GeometryType } from '$lib/geometry/enums';
import { describe, expect, it } from 'vitest';
import { generateId } from '$lib/domain/id';
import type { ChainData as ShapeChain } from '$lib/cam/chain/interfaces';
import { detectParts } from '$lib/cam/part/part-detection';
import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes';

describe('Part Detection Algorithm', () => {
    // Helper function to create test shapes
    function createLine(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ) {
        return new Shape({
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
            },
        });
    }

    function createCircle(centerX: number, centerY: number, radius: number) {
        return new Shape({
            id: generateId(),
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: centerX, y: centerY },
                radius,
            },
        });
    }

    // Helper function to create a rectangular chain (closed)
    function createRectangleChain(
        x: number,
        y: number,
        width: number,
        height: number
    ): ShapeChain {
        const id = generateId();
        return {
            id,
            name: id,
            shapes: [
                createLine(x, y, x + width, y), // Bottom edge
                createLine(x + width, y, x + width, y + height), // Right edge
                createLine(x + width, y + height, x, y + height), // Top edge
                createLine(x, y + height, x, y), // Left edge - closes the loop
            ],
        };
    }

    // Helper function to create a circular chain (closed)
    function createCircleChain(
        centerX: number,
        centerY: number,
        radius: number
    ): ShapeChain {
        const id = generateId();
        return {
            id,
            name: id,
            shapes: [createCircle(centerX, centerY, radius)],
        };
    }

    // Helper function to create an open chain
    function createOpenChain(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): ShapeChain {
        const id = generateId();
        return {
            id,
            name: id,
            shapes: [createLine(startX, startY, endX, endY)],
        };
    }

    describe('Basic Part Detection', () => {
        it('should detect no parts when no chains are provided', async () => {
            const result = await detectParts([]);
            expect(result.parts).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should detect no parts when only open chains are provided', async () => {
            const openChains = [
                createOpenChain(0, 0, 10, 0),
                createOpenChain(20, 0, 30, 0),
            ];

            const result = await detectParts(
                openChains.map((c) => new Chain(c))
            );
            expect(result.parts).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe('overlapping_boundary');
            expect(result.warnings[0].message).toContain('unclosed chain');
        });

        it('should detect a single part from a single closed chain', async () => {
            const chains = [createRectangleChain(0, 0, 10, 10)];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].shell.id).toBe(chains[0].id);
            expect(result.parts[0].shell.shapes).toEqual(chains[0].shapes);
            expect(result.parts[0].voids).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should detect multiple separate parts', async () => {
            const chains = [
                createRectangleChain(0, 0, 10, 10), // Part 1
                createRectangleChain(20, 20, 10, 10), // Part 2 (separate)
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(2);
            expect(result.parts[0].voids).toHaveLength(0);
            expect(result.parts[1].voids).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Shell and Hole Detection', () => {
        it('should detect a part with a single hole', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Outer shell
                createRectangleChain(5, 5, 10, 10), // Inner hole
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].shell.id).toBe(chains[0].id);
            expect(result.parts[0].shell.shapes).toEqual(chains[0].shapes);
            expect(result.parts[0].voids).toHaveLength(1);
            expect(result.parts[0].voids[0].chain.id).toBe(chains[1].id);
            expect(result.parts[0].voids[0].chain.shapes).toEqual(
                chains[1].shapes
            );
            expect(result.warnings).toHaveLength(0);
        });

        it('should detect a part with multiple holes', async () => {
            const chains = [
                createRectangleChain(0, 0, 30, 20), // Outer shell
                createRectangleChain(2, 2, 8, 8), // Hole 1
                createRectangleChain(20, 2, 8, 8), // Hole 2
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].shell.id).toBe(chains[0].id);
            expect(result.parts[0].shell.shapes).toEqual(chains[0].shapes);
            expect(result.parts[0].voids).toHaveLength(2);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle mixed shapes (rectangles and circles)', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Rectangular shell
                createCircleChain(10, 10, 3), // Circular hole
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].shell.id).toBe(chains[0].id);
            expect(result.parts[0].shell.shapes).toEqual(chains[0].shapes);
            expect(result.parts[0].voids).toHaveLength(1);
            expect(result.parts[0].voids[0].chain.id).toBe(chains[1].id);
            expect(result.parts[0].voids[0].chain.shapes).toEqual(
                chains[1].shapes
            );
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Hierarchical Nesting', () => {
        it('should detect nested parts (part within hole)', async () => {
            const chains = [
                createRectangleChain(0, 0, 30, 30), // Outer shell
                createRectangleChain(5, 5, 20, 20), // Hole in outer part
                createRectangleChain(10, 10, 10, 10), // Part within the hole
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(2);

            // Find parts by their geometric properties instead of object identity
            // The outer part should have the largest bounding box (30x30)
            const outerPart = result.parts.find((p) => {
                const bounds = p.boundingBox;
                return (
                    bounds.max.x - bounds.min.x === 30 &&
                    bounds.max.y - bounds.min.y === 30
                );
            });

            // The inner part should have the smallest bounding box (10x10)
            const innerPart = result.parts.find((p) => {
                const bounds = p.boundingBox;
                return (
                    bounds.max.x - bounds.min.x === 10 &&
                    bounds.max.y - bounds.min.y === 10
                );
            });

            expect(outerPart).toBeTruthy();
            expect(innerPart).toBeTruthy();
            expect(outerPart!.voids).toHaveLength(1);

            // The hole should be the middle-sized rectangle (20x20)
            const hole = outerPart!.voids[0];
            expect(hole.boundingBox.max.x - hole.boundingBox.min.x).toBe(20);
            expect(hole.boundingBox.max.y - hole.boundingBox.min.y).toBe(20);

            expect(innerPart!.voids).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle complex nesting (multiple levels)', async () => {
            const chains = [
                createRectangleChain(0, 0, 40, 40), // Level 1: Outer shell
                createRectangleChain(5, 5, 30, 30), // Level 2: Hole in outer
                createRectangleChain(10, 10, 20, 20), // Level 3: Part in hole
                createRectangleChain(15, 15, 10, 10), // Level 4: Hole in part
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(2);

            // Find parts by their geometric properties
            // The outer part should have the largest bounding box (40x40)
            const outerPart = result.parts.find((p) => {
                const bounds = p.boundingBox;
                return (
                    bounds.max.x - bounds.min.x === 40 &&
                    bounds.max.y - bounds.min.y === 40
                );
            });

            // The inner part should have the middle-sized bounding box (20x20)
            const innerPart = result.parts.find((p) => {
                const bounds = p.boundingBox;
                return (
                    bounds.max.x - bounds.min.x === 20 &&
                    bounds.max.y - bounds.min.y === 20
                );
            });

            expect(outerPart).toBeTruthy();
            expect(innerPart).toBeTruthy();
            expect(outerPart!.voids).toHaveLength(1);
            expect(innerPart!.voids).toHaveLength(1);

            // The outer part's hole should be 30x30
            const outerHole = outerPart!.voids[0];
            expect(
                outerHole.boundingBox.max.x - outerHole.boundingBox.min.x
            ).toBe(30);
            expect(
                outerHole.boundingBox.max.y - outerHole.boundingBox.min.y
            ).toBe(30);

            // The inner part's hole should be 10x10
            const innerHole = innerPart!.voids[0];
            expect(
                innerHole.boundingBox.max.x - innerHole.boundingBox.min.x
            ).toBe(10);
            expect(
                innerHole.boundingBox.max.y - innerHole.boundingBox.min.y
            ).toBe(10);

            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Warning Generation', () => {
        it('should generate warnings for open chains that might cross boundaries', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Closed boundary
                createOpenChain(5, 5, 25, 25), // Line crossing boundary
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe('overlapping_boundary');
            expect(result.warnings[0].chainId).toBe(chains[1].id);
            expect(result.warnings[0].message).toContain(
                'may cross the boundary'
            );
        });

        it('should not generate warnings for open chains outside boundaries', async () => {
            const chains = [
                createRectangleChain(0, 0, 10, 10), // Small boundary
                createOpenChain(20, 20, 30, 30), // Line far away
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should generate multiple warnings for multiple problematic chains', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Boundary
                createOpenChain(5, 5, 25, 25), // Crossing line 1
                createOpenChain(10, 10, 30, 30), // Crossing line 2
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.warnings).toHaveLength(2);
            expect(
                result.warnings.every((w) => w.type === 'overlapping_boundary')
            ).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle identical bounding boxes', async () => {
            const chains = [
                createRectangleChain(0, 0, 10, 10),
                createRectangleChain(0, 0, 10, 10), // Same size and position
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            // Should detect containment based on the algorithm's logic
            expect(result.parts.length).toBeGreaterThanOrEqual(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle very small chains', async () => {
            const chains = [
                createRectangleChain(0, 0, 0.1, 0.1),
                createRectangleChain(-1, -1, 2, 2),
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].voids).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle chains with single shapes', async () => {
            const chains = [createCircleChain(0, 0, 10)];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].shell.id).toBe(chains[0].id);
            expect(result.parts[0].shell.shapes).toEqual(chains[0].shapes);
            expect(result.parts[0].voids).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Bounding Box Calculations', () => {
        it('should correctly calculate bounding boxes for different shape types', async () => {
            const circleChain = createCircleChain(10, 10, 5);
            const rectChain = createRectangleChain(0, 0, 30, 30);

            const result = await detectParts([
                new Chain(rectChain),
                new Chain(circleChain),
            ]);
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].voids).toHaveLength(1); // Circle should be inside rectangle
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle negative coordinates', async () => {
            const chains = [
                createRectangleChain(-20, -20, 40, 40), // Large rectangle centered at origin
                createRectangleChain(-5, -5, 10, 10), // Small rectangle at origin
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].voids).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Chain Closure Detection', () => {
        it('should correctly identify closed chains', async () => {
            const closedChain = createRectangleChain(0, 0, 10, 10);
            const openChain = createOpenChain(0, 0, 10, 10);

            const result = await detectParts([
                new Chain(closedChain),
                new Chain(openChain),
            ]);
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].shell.id).toBe(closedChain.id);
            expect(result.parts[0].shell.shapes).toEqual(closedChain.shapes);
            expect(result.warnings).toHaveLength(0); // Open chain doesn't intersect
        });

        it('should handle nearly-closed chains (small gap)', async () => {
            // Create a chain with a very small gap (should be considered closed within tolerance)
            const nearlyClosedChainId = generateId();
            const nearlyClosedChain: ShapeChain = {
                id: nearlyClosedChainId,
                name: nearlyClosedChainId,
                shapes: [
                    createLine(0, 0, 10, 0),
                    createLine(10, 0, 10, 10),
                    createLine(10, 10, 0, 10),
                    createLine(0, 10, 0.005, 0), // Small gap to start point
                ],
            };

            const result = await detectParts([new Chain(nearlyClosedChain)]);
            expect(result.parts).toHaveLength(1); // Should be treated as closed
            expect(result.warnings).toHaveLength(0);
        });
    });
});
