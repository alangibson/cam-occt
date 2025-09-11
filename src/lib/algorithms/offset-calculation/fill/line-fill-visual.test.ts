import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    type Ellipse,
    GeometryType,
    type Line,
    type Shape,
} from '$lib/types/geometry';
import { SVGBuilder } from '../../../test/svg-builder';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { detectShapeChains } from '../../chain-detection/chain-detection';
import { normalizeChain } from '../../chain-normalization/chain-normalization';
import { offsetChain } from '../chain/offset';
import type { OffsetChain } from '../chain/types';

describe('Line-Line Gap Fill Visual Validation', { timeout: 180000 }, () => {
    const outputDir = 'tests/output/visual/fill';

    beforeAll(() => {
        try {
            mkdirSync(outputDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    });

    // Helper function to generate simple chain SVG using SVGBuilder
    function generateSimpleChainSVG(
        chain: Chain,
        offsets: OffsetChain[],
        filename: string
    ) {
        const svg = new SVGBuilder();

        // Draw original chain shapes (black)
        for (const shape of chain.shapes) {
            svg.addShape(shape, 'black', 2);
        }

        // Draw offset chains
        for (const offset of offsets) {
            const color = offset.side === 'outer' ? 'red' : 'blue';
            const strokeWidth =
                offset.gapFills && offset.gapFills.length > 0 ? 3 : 1;

            for (const shape of offset.shapes) {
                svg.addShape(shape, color, strokeWidth);
            }

            // Highlight gap fills with orange if they exist
            if (offset.gapFills && offset.gapFills.length > 0) {
                for (const gapFill of offset.gapFills) {
                    // Draw filler shape if it exists
                    if (gapFill.fillerShape) {
                        svg.addShape(gapFill.fillerShape, 'orange', 2);
                    }
                    // Draw modified shapes
                    for (const modifiedShape of gapFill.modifiedShapes) {
                        svg.addShape(modifiedShape.modified, 'orange', 2);
                    }
                }
            }
        }

        // Add title and gap fill count
        svg.addText(10, 30, filename, 'black', '16px');
        const totalGapFills = offsets.reduce(
            (sum, offset) => sum + (offset.gapFills?.length || 0),
            0
        );
        svg.addText(10, 50, `Gap Fills: ${totalGapFills}`, 'black', '12px');

        const svgContent = svg.toString();
        const outputPath = join(outputDir, `${filename}.svg`);
        writeFileSync(outputPath, svgContent);
    }

    // Helper function to create test shapes that form a connected chain
    function createChainShapes(): Shape[] {
        return [
            {
                id: 'line1',
                type: GeometryType.LINE as const,
                geometry: {
                    start: { x: 100, y: 200 },
                    end: { x: 180, y: 200 },
                } as Line,
            },
            {
                id: 'line2',
                type: GeometryType.LINE as const,
                geometry: {
                    start: { x: 180, y: 200 },
                    end: { x: 220, y: 160 },
                } as Line,
            },
            {
                id: 'line3',
                type: GeometryType.LINE as const,
                geometry: {
                    start: { x: 220, y: 160 },
                    end: { x: 220, y: 100 },
                } as Line,
            },
            {
                id: 'line4',
                type: GeometryType.LINE as const,
                geometry: {
                    start: { x: 220, y: 100 },
                    end: { x: 100, y: 100 },
                } as Line,
            },
            {
                id: 'line5',
                type: GeometryType.LINE as const,
                geometry: {
                    start: { x: 100, y: 100 },
                    end: { x: 100, y: 200 },
                } as Line,
            },
        ];
    }

    // Helper function to visualize chain offset with gap filling
    function visualizeChainWithGapFill(
        shapes: Shape[],
        testName: string,
        offsetDistance: number = 8,
        tolerance: number = 0.1
    ) {
        // Detect and normalize the chain
        const detectedChains = detectShapeChains(shapes, { tolerance });
        expect(detectedChains.length).toBeGreaterThan(0);

        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: tolerance,
            maxTraversalAttempts: 5,
        });

        // Generate offset with gap filling
        const chainOffsetResult = offsetChain(chain, offsetDistance, {
            tolerance,
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
        generateSimpleChainSVG(chain, offsets, testName);

        // Return results for testing
        return {
            success: chainOffsetResult.success,
            gapsFilled: chainOffsetResult.metrics?.gapsFilled || 0,
            innerContinuous: chainOffsetResult.innerChain?.continuous || false,
            outerContinuous: chainOffsetResult.outerChain?.continuous || false,
            innerGapFills: chainOffsetResult.innerChain?.gapFills?.length || 0,
            outerGapFills: chainOffsetResult.outerChain?.gapFills?.length || 0,
        };
    }

    // Chain gap fill tests
    describe('Chain gap fill tests', () => {
        it('should test chain with gap filling', () => {
            const shapes = createChainShapes();

            const result = visualizeChainWithGapFill(
                shapes,
                'line-chain-gap-filled',
                8,
                0.1
            );

            // Verify that the chain offset succeeded
            expect(result.success).toBe(true);

            // Log the results
            console.log(`Chain gap fill test results:
        - Chain offset success: ${result.success}
        - Total gaps filled: ${result.gapsFilled}
        - Inner chain continuous: ${result.innerContinuous}
        - Outer chain continuous: ${result.outerContinuous}  
        - Inner chain gap fills: ${result.innerGapFills}
        - Outer chain gap fills: ${result.outerGapFills}`);

            // Expect some form of gap filling or continuity
            const hasGapFills = result.gapsFilled > 0;
            const hasContinuity =
                result.innerContinuous || result.outerContinuous;
            expect(hasGapFills || hasContinuity).toBe(true);
        });

        it('should test Line-EllipseArc gaps with trim and fill', () => {
            // Based on ellipse-arc-chain.dxf test file
            // Ellipse arc from center (0,0), major axis (30,0), ratio 0.6, from 0 to π/2
            // Line from (0,18) to (50,50) - positioned to create gap with ellipse arc
            const ellipseArc = {
                id: 'ellipseArc1',
                type: GeometryType.ELLIPSE as const,
                geometry: {
                    center: { x: 200, y: 200 },
                    majorAxisEndpoint: { x: 30, y: 0 },
                    minorToMajorRatio: 0.6,
                    startParam: 0,
                    endParam: Math.PI / 2,
                } as Ellipse,
            };
            const line = {
                id: 'line1',
                type: GeometryType.LINE as const,
                geometry: {
                    start: { x: 200, y: 218 },
                    end: { x: 250, y: 250 },
                } as Line,
            };

            const shapes = [ellipseArc, line];
            const result = visualizeChainWithGapFill(
                shapes,
                'line-ellipsearc-gap-filled',
                8,
                0.1
            );

            // Verify that the chain offset succeeded
            expect(result.success).toBe(true);
        });
    });
});
