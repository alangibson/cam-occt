import { Chain } from '$lib/cam/chain/classes.svelte';
import { describe, expect, it } from 'vitest';
import { getShapeEndPoint, getShapeStartPoint } from '$lib/cam/shape/functions';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ChainData } from '$lib/cam/chain/interfaces';
import {
    analyzeChainTraversal,
    normalizeChain,
} from '$lib/cam/chain/chain-normalization';

describe('Chain Normalization', () => {
    // Helper function to create a line shape
    function createLine(
        id: string,
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): ShapeData {
        return {
            id,
            type: GeometryType.LINE,
            geometry: { start, end },
        } as ShapeData;
    }

    // Helper function to create a test chain
    function createChain(id: string, shapes: ShapeData[]): ChainData {
        return {
            id,
            name: id,
            shapes,
        };
    }

    describe('analyzeChainTraversal', () => {
        it('should detect no issues in properly connected chain', () => {
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }), // Line 1: (0,0) to (10,0)
                createLine('line2', { x: 10, y: 0 }, { x: 10, y: 10 }), // Line 2: (10,0) to (10,10) - connects end-to-start
                createLine('line3', { x: 10, y: 10 }, { x: 0, y: 10 }), // Line 3: (10,10) to (0,10) - connects end-to-start
            ];

            const chain = createChain('chain-1', shapes);
            const results = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 5,
            });

            expect(results).toHaveLength(1);
            expect(results[0].chainId).toBe('chain-1');
            expect(results[0].canTraverse).toBe(true);
            expect(results[0].issues).toHaveLength(0);
        });

        it('should detect coincident endpoints issue', () => {
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }), // Line 1: ends at (10,0)
                createLine('line2', { x: 5, y: 5 }, { x: 10, y: 0 }), // Line 2: also ends at (10,0) - problem!
                createLine('line3', { x: 5, y: 5 }, { x: 0, y: 10 }), // Line 3: starts at (5,5) - can connect if line2 is reversed
            ];

            const chain = createChain('chain-1', shapes);
            const results = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 5,
            });

            expect(results).toHaveLength(1);
            expect(results[0].canTraverse).toBe(false);
            expect(results[0].issues.length).toBeGreaterThan(0);

            const endpointIssue = results[0].issues.find(
                (issue) => issue.type === 'coincident_endpoints'
            );
            expect(endpointIssue).toBeDefined();
            expect(endpointIssue?.description).toContain(
                'both end at the same point'
            );
        });

        it('should detect coincident startpoints issue', () => {
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 5, y: 5 }), // Line 1: ends at (5,5)
                createLine('line2', { x: 5, y: 5 }, { x: 10, y: 0 }), // Line 2: starts at (5,5) - good connection
                createLine('line3', { x: 5, y: 5 }, { x: 0, y: 10 }), // Line 3: also starts at (5,5) - problem!
            ];

            const chain = createChain('chain-1', shapes);
            const results = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 5,
            });

            expect(results).toHaveLength(1);
            expect(results[0].canTraverse).toBe(false);
            expect(results[0].issues.length).toBeGreaterThan(0);

            const startpointIssue = results[0].issues.find(
                (issue) => issue.type === 'coincident_startpoints'
            );
            expect(startpointIssue).toBeDefined();
            expect(startpointIssue?.description).toContain(
                'both start at the same point'
            );
        });

        it('should detect broken traversal with non-adjacent coincident points', () => {
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }), // Line 1
                createLine('line2', { x: 10, y: 0 }, { x: 10, y: 10 }), // Line 2 - connects properly
                createLine('line3', { x: 5, y: 5 }, { x: 0, y: 0 }), // Line 3 - coincident with line1 start (non-adjacent)
                createLine('line4', { x: 10, y: 10 }, { x: 0, y: 10 }), // Line 4
            ];

            const chain = createChain('chain-1', shapes);
            const results = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 5,
            });

            expect(results).toHaveLength(1);
            expect(results[0].issues.length).toBeGreaterThan(0);

            const traversalIssue = results[0].issues.find(
                (issue) => issue.type === 'broken_traversal'
            );
            expect(traversalIssue).toBeDefined();
            expect(traversalIssue?.description).toContain('Non-sequent shapes');
        });

        it('should handle single shape chain', () => {
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            const chain = createChain('chain-1', shapes);
            const results = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 5,
            });

            expect(results).toHaveLength(1);
            expect(results[0].canTraverse).toBe(true);
            expect(results[0].issues).toHaveLength(0);
        });

        it('should handle empty chain', () => {
            const chain = createChain('chain-1', []);
            const results = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 5,
            });

            expect(results).toHaveLength(1);
            expect(results[0].canTraverse).toBe(true);
            expect(results[0].issues).toHaveLength(0);
        });

        it('should detect when non-sequent shapes have coincident points indicating improper ordering', () => {
            // This test reproduces the exact issue from 2013-11-08_test.dxf
            // Where "Non-sequent shapes 1 and 7 have coincident points at (60.000, 75.000)"
            // This indicates the normalization didn't properly order the shapes

            // Create a chain that mimics the problematic inner chain from the DXF
            // After normalization, shapes at indices 1 and 7 will have coincident points
            const shapes = [
                createLine('shape0', { x: 60, y: 75 }, { x: 65, y: 75 }), // Index 0 after norm
                createLine('shape7', { x: 60, y: 75 }, { x: 60, y: 80 }), // Will be index 1 after norm - starts at (60,75)
                createLine('shape2', { x: 65, y: 75 }, { x: 70, y: 75 }), // Index 2 after norm
                createLine('shape3', { x: 70, y: 75 }, { x: 70, y: 85 }), // Index 3 after norm
                createLine('shape4', { x: 70, y: 85 }, { x: 60, y: 85 }), // Index 4 after norm
                createLine('shape5', { x: 60, y: 85 }, { x: 60, y: 80 }), // Index 5 after norm
                createLine('shape6', { x: 60, y: 80 }, { x: 55, y: 80 }), // Index 6 after norm
                createLine('shape1', { x: 55, y: 80 }, { x: 60, y: 75 }), // Will be index 7 after norm - ends at (60,75)
            ];

            const chain = createChain('chain-1', shapes);

            // Normalize the chain
            const normalizedChain = normalizeChain(new Chain(chain), {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });

            console.log(
                'Original indices:',
                shapes.map((s, i) => `${i}:${s.id}`)
            );
            console.log(
                'Normalized order:',
                normalizedChain.shapes.map((s, i) => `${i}:${s.id}`)
            );

            // Now analyze the normalized chain to detect the issue
            const results = analyzeChainTraversal([normalizedChain], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });

            // Find if there are shapes at indices 1 and 7 with coincident points
            if (normalizedChain.shapes.length >= 8) {
                const shape1 = normalizedChain.shapes[1];
                const shape7 = normalizedChain.shapes[7];

                const shape1Start = getShapeStartPoint(shape1);
                const shape1End = getShapeEndPoint(shape1);
                const shape7Start = getShapeStartPoint(shape7);
                const shape7End = getShapeEndPoint(shape7);

                console.log(
                    `Shape at index 1 (${shape1.id}): start (${shape1Start.x},${shape1Start.y}), end (${shape1End.x},${shape1End.y})`
                );
                console.log(
                    `Shape at index 7 (${shape7.id}): start (${shape7Start.x},${shape7Start.y}), end (${shape7End.x},${shape7End.y})`
                );
            }

            // The issue: broken traversal warnings for non-sequent shapes with coincident points
            const brokenTraversalIssues = results[0].issues.filter(
                (issue) =>
                    issue.type === 'broken_traversal' &&
                    issue.description.includes('Non-sequent shapes')
            );

            if (brokenTraversalIssues.length > 0) {
                console.log(
                    'Broken traversal issues:',
                    brokenTraversalIssues.map((i) => i.description)
                );
            }

            // The bug is that these warnings appear even when the chain is traversable
            expect(results[0].canTraverse).toBe(true);

            // This test expects the current buggy behavior - there will be false warnings
            // After fixing, we should update this test
            expect(brokenTraversalIssues.length).toBeGreaterThan(0);
            expect(brokenTraversalIssues[0].description).toContain(
                'Non-sequent shapes'
            );
            expect(brokenTraversalIssues[0].description).toContain(
                'have coincident points'
            );
        });

        it('should ensure shapes with coincident points are adjacent after normalization', () => {
            // This test reproduces the issue from 2013-11-08_test.dxf
            // Create a chain where shapes are out of order
            // After normalization, all shapes with coincident points should be adjacent

            // Create shapes that are scrambled and need normalization
            // shape1 and shape7 have coincident points at (60,75)
            const shapes = [
                createLine('shape1', { x: 60, y: 75 }, { x: 70, y: 75 }), // Start at (60,75)
                createLine('shape3', { x: 70, y: 80 }, { x: 70, y: 85 }), // Out of order
                createLine('shape4', { x: 70, y: 85 }, { x: 60, y: 85 }), // Out of order
                createLine('shape5', { x: 60, y: 85 }, { x: 60, y: 80 }), // Out of order
                createLine('shape6', { x: 60, y: 80 }, { x: 65, y: 80 }), // Out of order
                createLine('shape2', { x: 70, y: 75 }, { x: 70, y: 80 }), // Should come after shape1
                createLine('shape7', { x: 65, y: 80 }, { x: 65, y: 75 }), // Out of order
                createLine('shape8', { x: 65, y: 75 }, { x: 60, y: 75 }), // End at (60,75) - coincident with shape1 start
            ];

            const chain = createChain('chain-1', shapes);

            // Normalize the chain - this should reorder shapes so connected shapes are adjacent
            const normalizedChain = normalizeChain(new Chain(chain), {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });

            console.log(
                'Original order:',
                shapes.map((s) => s.id)
            );
            console.log(
                'Normalized order:',
                normalizedChain.shapes.map((s) => s.id)
            );

            // Find indices of shape1 and shape8 (which have coincident points at 60,75)
            const shape1Index = normalizedChain.shapes.findIndex(
                (s) => s.id === 'shape1'
            );
            const shape8Index = normalizedChain.shapes.findIndex(
                (s) => s.id === 'shape8'
            );

            console.log(
                `shape1 index: ${shape1Index}, shape8 index: ${shape8Index}`
            );
            console.log(
                `Distance between them: ${Math.abs(shape1Index - shape8Index)}`
            );

            // After proper normalization, shapes with coincident points should be adjacent
            // Either shape8 should be right before shape1, or shape1 should be at start and shape8 at end (closed chain)
            const isAdjacent = Math.abs(shape1Index - shape8Index) === 1;
            const isClosedChain =
                (shape1Index === 0 &&
                    shape8Index === normalizedChain.shapes.length - 1) ||
                (shape8Index === 0 &&
                    shape1Index === normalizedChain.shapes.length - 1);

            // The bug: normalization doesn't ensure shapes with coincident points are adjacent
            // This test will fail if normalization leaves them non-adjacent
            expect(isAdjacent || isClosedChain).toBe(true);

            // Also verify the chain is traversable
            const results = analyzeChainTraversal([normalizedChain], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });
            expect(results[0].canTraverse).toBe(true);

            // And there should be no broken traversal warnings
            const brokenTraversalIssues = results[0].issues.filter(
                (issue) => issue.type === 'broken_traversal'
            );
            expect(brokenTraversalIssues).toHaveLength(0);
        });
    });

    describe('normalizeChain', () => {
        it('should reorder shapes for proper traversal', () => {
            // Create shapes in wrong order
            const shapes = [
                createLine('line1', { x: 10, y: 0 }, { x: 10, y: 10 }), // Should be second
                createLine('line2', { x: 0, y: 0 }, { x: 10, y: 0 }), // Should be first
                createLine('line3', { x: 10, y: 10 }, { x: 0, y: 10 }), // Should be third
            ];

            const chain = createChain('chain-1', shapes);
            const normalizedChain = normalizeChain(new Chain(chain));

            // Should reorder to: line2 -> line1 -> line3
            expect(normalizedChain.shapes).toHaveLength(3);
            expect(normalizedChain.shapes[0].id).toBe('line2'); // (0,0) to (10,0)
            expect(normalizedChain.shapes[1].id).toBe('line1'); // (10,0) to (10,10)
            expect(normalizedChain.shapes[2].id).toBe('line3'); // (10,10) to (0,10)

            // Verify the chain can now be traversed
            const analysis = analyzeChainTraversal([normalizedChain], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });
            expect(analysis[0].canTraverse).toBe(true);
            expect(analysis[0].issues).toHaveLength(0);
        });

        it('should reverse shapes when needed for proper connectivity', () => {
            // Create shapes where line2 needs to be reversed
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }), // (0,0) to (10,0)
                createLine('line2', { x: 10, y: 10 }, { x: 10, y: 0 }), // (10,10) to (10,0) - backwards!
                createLine('line3', { x: 10, y: 10 }, { x: 0, y: 10 }), // (10,10) to (0,10)
            ];

            const chain = createChain('chain-1', shapes);
            const normalizedChain = normalizeChain(new Chain(chain));

            // Should keep line1, reverse line2, then add line3
            expect(normalizedChain.shapes).toHaveLength(3);

            // Check that line2 was reversed
            const normalizedLine2 = normalizedChain.shapes[1];
            const line2Geom = normalizedLine2.geometry as Line;
            expect(line2Geom.start.x).toBe(10);
            expect(line2Geom.start.y).toBe(0);
            expect(line2Geom.end.x).toBe(10);
            expect(line2Geom.end.y).toBe(10);

            // Verify the chain can now be traversed
            const analysis = analyzeChainTraversal([normalizedChain], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });
            expect(analysis[0].canTraverse).toBe(true);
            expect(analysis[0].issues).toHaveLength(0);
        });

        it('should fix coincident endpoints issue', () => {
            // Create shapes with coincident endpoints that can be fixed by reordering
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }), // ends at (10,0)
                createLine('line2', { x: 5, y: 5 }, { x: 10, y: 0 }), // also ends at (10,0) - needs reversal!
                createLine('line3', { x: 5, y: 5 }, { x: 0, y: 10 }), // should connect to reversed line2
            ];

            const chain = createChain('chain-1', shapes);

            // Before normalization - should have issues
            const beforeAnalysis = analyzeChainTraversal([new Chain(chain)], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });
            expect(beforeAnalysis[0].canTraverse).toBe(false);
            expect(beforeAnalysis[0].issues.length).toBeGreaterThan(0);

            const normalizedChain = normalizeChain(new Chain(chain));

            // After normalization - should be fixed
            const afterAnalysis = analyzeChainTraversal([normalizedChain], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });
            expect(afterAnalysis[0].canTraverse).toBe(true);
            expect(afterAnalysis[0].issues).toHaveLength(0);
        });

        it('should handle disconnected shapes', () => {
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
                createLine('line2', { x: 20, y: 20 }, { x: 30, y: 30 }), // Disconnected
            ];

            const chain = createChain('chain-1', shapes);
            const normalizedChain = normalizeChain(new Chain(chain));

            // Should still have 2 shapes
            expect(normalizedChain.shapes).toHaveLength(2);
        });

        it('should preserve arc sweep direction when reversing', () => {
            // Helper function to create arc shapes
            function createArc(
                id: string,
                center: { x: number; y: number },
                radius: number,
                startAngle: number,
                endAngle: number,
                clockwise: boolean = false
            ): ShapeData {
                return {
                    id,
                    type: GeometryType.ARC,
                    geometry: {
                        center,
                        radius,
                        startAngle,
                        endAngle,
                        clockwise,
                    },
                } as ShapeData;
            }

            // Create shapes that require arc reversal for proper chain connectivity
            const shapes = [
                createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }), // Line from (0,0) to (10,0)
                createArc(
                    'arc1',
                    { x: 10, y: 5 },
                    5,
                    Math.PI / 2,
                    -Math.PI / 2,
                    true
                ), // CW arc ending at (10,0), starting at (10,10)
                createLine('line2', { x: 10, y: 10 }, { x: 0, y: 10 }), // Line from (10,10) to (0,10)
            ];

            const chain = createChain('chain-1', shapes);
            const normalizedChain = normalizeChain(new Chain(chain));

            // Find the reversed arc in the normalized chain
            const normalizedArc = normalizedChain.shapes.find(
                (shape) => shape.id === 'arc1'
            );
            expect(normalizedArc).toBeDefined();

            if (normalizedArc && normalizedArc.type === 'arc') {
                const arcGeom = normalizedArc.geometry as Arc;

                // The arc should have been reversed (angles swapped)
                expect(arcGeom.startAngle).toBeCloseTo(-Math.PI / 2, 5);
                expect(arcGeom.endAngle).toBeCloseTo(Math.PI / 2, 5);

                // CRITICAL: The clockwise flag should be flipped to maintain sweep direction
                expect(arcGeom.clockwise).toBe(false); // Originally true, should now be false
            }

            // Verify the chain can be traversed properly after normalization
            const analysis = analyzeChainTraversal([normalizedChain], {
                traversalTolerance: 0.01,
                maxTraversalAttempts: 10,
            });
            expect(analysis[0].canTraverse).toBe(true);
            expect(analysis[0].issues).toHaveLength(0);
        });
    });
});
