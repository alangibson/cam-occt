import { describe, it, expect, beforeAll } from 'vitest';
import { offsetChain } from '../chain/offset';
import { detectShapeChains } from '../../chain-detection/chain-detection';
import { normalizeChain } from '../../chain-normalization/chain-normalization';
import { generateChainOffsetSVG } from '../chain/visual-tests';
import type { Shape } from '../../../types/geometry';
import type { OffsetChain } from '../chain/types';
import { mkdirSync } from 'fs';
import { join } from 'path';

describe('Gap Filling Visual Validation', () => {
    // Ensure output directory exists
    beforeAll(() => {
        const outputDir = join(
            process.cwd(),
            'tests',
            'output',
            'visual',
            'gap-filling'
        );
        mkdirSync(outputDir, { recursive: true });
    });

    // Helper to create shapes
    function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
        return {
            id: `line-${Math.random()}`,
            type: 'line',
            geometry: {
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
            },
        };
    }

    function createArc(
        cx: number,
        cy: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): Shape {
        return {
            id: `arc-${Math.random()}`,
            type: 'arc',
            geometry: {
                center: { x: cx, y: cy },
                radius,
                startAngle,
                endAngle,
                clockwise,
            },
        };
    }

    it('should visually validate line-arc gap filling', () => {
        // Create a line-arc sequence that will demonstrate gap filling
        const shapes: Shape[] = [
            createLine(20, 40, 80, 40), // Horizontal line
            createArc(80, 40, 25, -Math.PI / 2, 0, false), // Quarter arc upward
            createLine(105, 40, 105, 100), // Vertical line up
            createLine(105, 100, 20, 100), // Top horizontal line
            createLine(20, 100, 20, 40), // Left vertical line down
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.1,
            maxTraversalAttempts: 5,
        });

        // Generate offset with gap filling
        const offsetDistance = 12;
        const chainOffsetResult = offsetChain(chain, offsetDistance, {
            tolerance: 0.1,
            maxExtension: 50,
            snapThreshold: 0.5,
        });

        // Collect all offset chains for visualization
        const offsets: OffsetChain[] = [];
        if (chainOffsetResult.innerChain) {
            offsets.push(chainOffsetResult.innerChain);
        }
        if (chainOffsetResult.outerChain) {
            offsets.push(chainOffsetResult.outerChain);
        }

        // Generate SVG with custom path for gap filling tests
        void generateChainOffsetSVG(chain, offsets, 'line-arc-gap-filling', {
            width: 800,
            height: 600,
        });

        // Verify results
        expect(chainOffsetResult.success).toBe(true);
        expect(chainOffsetResult.metrics?.gapsFilled).toBeGreaterThanOrEqual(0);

        // Check that gap fills are recorded
        const totalGapFills =
            (chainOffsetResult.innerChain?.gapFills?.length || 0) +
            (chainOffsetResult.outerChain?.gapFills?.length || 0);

        if (totalGapFills > 0) {
            console.log(
                `✅ Gap filling test: ${totalGapFills} gaps filled successfully`
            );

            // Verify gap fill metadata
            const allGapFills = [
                ...(chainOffsetResult.innerChain?.gapFills || []),
                ...(chainOffsetResult.outerChain?.gapFills || []),
            ];

            allGapFills.forEach((gapFill, index) => {
                expect(gapFill.method).toBe('extend');
                expect(gapFill.gapSize).toBeGreaterThan(0);
                expect(gapFill.modifiedShapes).toHaveLength(2);
                console.log(
                    `  Gap ${index + 1}: size=${gapFill.gapSize.toFixed(3)}, method=${gapFill.method}`
                );
            });
        } else {
            console.log(
                'ℹ️  No gaps needed filling (shapes already connected)'
            );
        }
    });

    it('should demonstrate gap filling on problematic geometry', () => {
        // Create geometry specifically designed to have gaps in offsets
        const shapes: Shape[] = [
            createLine(30, 30, 90, 30), // Bottom line
            createArc(90, 50, 20, -Math.PI / 2, -Math.PI / 4, false), // Angled arc
            createLine(104.14, 35.86, 130, 60), // Diagonal line
            createLine(130, 60, 100, 90), // Another diagonal
            createLine(100, 90, 30, 90), // Top line
            createLine(30, 90, 30, 30), // Left line
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.5 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.5,
            maxTraversalAttempts: 5,
        });

        const chainOffsetResult = offsetChain(chain, 8, {
            tolerance: 0.1,
            maxExtension: 30,
            snapThreshold: 0.5,
        });

        const offsets: OffsetChain[] = [];
        if (chainOffsetResult.innerChain) {
            offsets.push(chainOffsetResult.innerChain);
        }
        if (chainOffsetResult.outerChain) {
            offsets.push(chainOffsetResult.outerChain);
        }

        generateChainOffsetSVG(
            chain,
            offsets,
            'problematic-geometry-gap-filling',
            {
                width: 1000,
                height: 700,
            }
        );

        expect(chainOffsetResult.success).toBe(true);

        // This geometry should demonstrate gap filling in action
        console.log(
            `Problematic geometry test: ${chainOffsetResult.metrics?.gapsFilled || 0} gaps filled`
        );
    });

    it('should handle multiple gap types in one chain', () => {
        // Create a chain with different types of gaps
        const shapes: Shape[] = [
            createLine(10, 10, 40, 10), // Line 1
            createLine(45, 10, 75, 10), // Line 2 (small gap)
            createArc(75, 10, 15, 0, Math.PI / 2, false), // Arc (potential gap)
            createLine(90, 25, 90, 50), // Line 3 (gap from arc)
            createArc(90, 50, 20, Math.PI / 2, Math.PI, false), // Arc 2
            createLine(70, 50, 40, 50), // Line 4
            createLine(40, 50, 10, 50), // Line 5
            createLine(10, 50, 10, 10), // Closing line
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 1.0 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 1.0,
            maxTraversalAttempts: 5,
        });

        const chainOffsetResult = offsetChain(chain, 6, {
            tolerance: 0.2,
            maxExtension: 25,
            snapThreshold: 1.0,
        });

        const offsets: OffsetChain[] = [];
        if (chainOffsetResult.innerChain) {
            offsets.push(chainOffsetResult.innerChain);
        }
        if (chainOffsetResult.outerChain) {
            offsets.push(chainOffsetResult.outerChain);
        }

        generateChainOffsetSVG(chain, offsets, 'multiple-gap-types', {
            width: 800,
            height: 500,
        });

        expect(chainOffsetResult.success).toBe(true);

        const gapsFilled = chainOffsetResult.metrics?.gapsFilled || 0;
        console.log(`Multiple gap types test: ${gapsFilled} gaps filled`);

        // Should handle various gap scenarios without failing
        expect(chainOffsetResult.metrics).toBeDefined();
        expect(chainOffsetResult.metrics!.processingTimeMs).toBeGreaterThan(0);
    });
});
