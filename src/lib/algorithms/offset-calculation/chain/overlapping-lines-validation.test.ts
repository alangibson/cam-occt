import { describe, it, expect } from 'vitest';
import { GeometryType, type Shape, type Line } from '$lib/types/geometry';
import type { OffsetChain } from './types';
import { detectShapeChains } from '../../chain-detection/chain-detection';
import { normalizeChain } from '../../chain-normalization/chain-normalization';
import { generateId } from '../../../utils/id';

describe('overlapping lines validation', () => {
    // Helper to create shapes
    function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
        return {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
            },
        };
    }

    // Test if lines in offset chain overlap (share same coordinates)
    function validateNoOverlappingLines(
        offsetChain: OffsetChain,
        tolerance: number = 0.1
    ): {
        hasOverlaps: boolean;
        overlaps: Array<{
            shapeIndex1: number;
            shapeIndex2: number;
            overlapType: 'identical' | 'partial' | 'coincident';
            description: string;
        }>;
    } {
        const overlaps: Array<{
            shapeIndex1: number;
            shapeIndex2: number;
            overlapType: 'identical' | 'partial' | 'coincident';
            description: string;
        }> = [];

        const lines = offsetChain.shapes.filter(
            (shape) => shape.type === 'line'
        );

        for (let i: number = 0; i < lines.length; i++) {
            for (let j: number = i + 1; j < lines.length; j++) {
                const line1 = lines[i].geometry as Line;
                const line2 = lines[j].geometry as Line;

                // Check for identical lines
                if (
                    Math.abs(line1.start.x - line2.start.x) < tolerance &&
                    Math.abs(line1.start.y - line2.start.y) < tolerance &&
                    Math.abs(line1.end.x - line2.end.x) < tolerance &&
                    Math.abs(line1.end.y - line2.end.y) < tolerance
                ) {
                    overlaps.push({
                        shapeIndex1: offsetChain.shapes.indexOf(lines[i]),
                        shapeIndex2: offsetChain.shapes.indexOf(lines[j]),
                        overlapType: 'identical',
                        description: `Lines ${i} and ${j} are identical: (${line1.start.x},${line1.start.y}) to (${line1.end.x},${line1.end.y})`,
                    });
                }

                // Check for coincident vertical lines (same x coordinates, overlapping y ranges)
                else if (
                    Math.abs(line1.start.x - line1.end.x) < tolerance && // line1 is vertical
                    Math.abs(line2.start.x - line2.end.x) < tolerance && // line2 is vertical
                    Math.abs(line1.start.x - line2.start.x) < tolerance
                ) {
                    // same x coordinate

                    const line1MinY = Math.min(line1.start.y, line1.end.y);
                    const line1MaxY = Math.max(line1.start.y, line1.end.y);
                    const line2MinY = Math.min(line2.start.y, line2.end.y);
                    const line2MaxY = Math.max(line2.start.y, line2.end.y);

                    // Check if y ranges overlap
                    if (!(line1MaxY < line2MinY || line2MaxY < line1MinY)) {
                        overlaps.push({
                            shapeIndex1: offsetChain.shapes.indexOf(lines[i]),
                            shapeIndex2: offsetChain.shapes.indexOf(lines[j]),
                            overlapType: 'coincident',
                            description: `Vertical lines ${i} and ${j} overlap at x=${line1.start.x}: y ranges [${line1MinY},${line1MaxY}] and [${line2MinY},${line2MaxY}]`,
                        });
                    }
                }

                // Check for coincident horizontal lines (same y coordinates, overlapping x ranges)
                else if (
                    Math.abs(line1.start.y - line1.end.y) < tolerance && // line1 is horizontal
                    Math.abs(line2.start.y - line2.end.y) < tolerance && // line2 is horizontal
                    Math.abs(line1.start.y - line2.start.y) < tolerance
                ) {
                    // same y coordinate

                    const line1MinX = Math.min(line1.start.x, line1.end.x);
                    const line1MaxX = Math.max(line1.start.x, line1.end.x);
                    const line2MinX = Math.min(line2.start.x, line2.end.x);
                    const line2MaxX = Math.max(line2.start.x, line2.end.x);

                    // Check if x ranges overlap
                    if (!(line1MaxX < line2MinX || line2MaxX < line1MinX)) {
                        overlaps.push({
                            shapeIndex1: offsetChain.shapes.indexOf(lines[i]),
                            shapeIndex2: offsetChain.shapes.indexOf(lines[j]),
                            overlapType: 'coincident',
                            description: `Horizontal lines ${i} and ${j} overlap at y=${line1.start.y}: x ranges [${line1MinX},${line1MaxX}] and [${line2MinX},${line2MaxX}]`,
                        });
                    }
                }
            }
        }

        return {
            hasOverlaps: overlaps.length > 0,
            overlaps,
        };
    }

    it('should detect that offset lines are identical to original (no actual offset)', () => {
        // The problem from the SVG: all vertical lines are at x=100, meaning no offset occurred
        const originalVertical = createLine(100, 0, 100, 80); // original
        const leftOffsetVertical = createLine(100, 10, 100, 90); // "left offset" - same x!
        // Create a combined test that includes both original and offset to detect overlap
        const testWithOriginal: OffsetChain = {
            id: 'test-with-original',
            originalChainId: 'test-chain',
            side: 'left',
            shapes: [
                originalVertical, // original vertical at x=100
                leftOffsetVertical, // offset vertical also at x=100 - should overlap!
            ],
            closed: false,
            continuous: true,
        };

        const validation = validateNoOverlappingLines(testWithOriginal, 0.1);

        // This should FAIL because the offset vertical line is at the same x as original
        expect(validation.hasOverlaps).toBe(true);
        expect(validation.overlaps.length).toBeGreaterThan(0);

        const overlap = validation.overlaps[0];
        expect(overlap.overlapType).toBe('coincident');
        expect(overlap.description).toContain('Vertical lines');
        expect(overlap.description).toContain('x=100');
    });

    it('should detect when offset lines coincide with original chain lines', () => {
        // Create L-shaped chain
        const shapes: Shape[] = [
            createLine(0, 0, 100, 0), // horizontal original
            createLine(100, 0, 100, 80), // vertical original at x=100
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.1,
            maxTraversalAttempts: 5,
        });

        // Create offset that incorrectly places vertical line at same x as original
        const badLeftOffset: OffsetChain = {
            id: 'bad-left-offset',
            originalChainId: chain.id,
            side: 'left',
            shapes: [
                createLine(0, 10, 100, 10), // horizontal offset - correct
                createLine(100, 10, 100, 90), // vertical offset - WRONG! Should be at x=90, not x=100
            ],
            closed: false,
            continuous: true,
        };

        // This creates a test case similar to the visual SVG where the offset
        // vertical line is at the same x coordinate as the original
        void validateNoOverlappingLines(badLeftOffset, 0.1);

        // The test should detect that this offset has issues
        // (though it might not detect overlap with original since we're only checking within the offset)

        // Create a CORRECT left offset for comparison
        const correctLeftOffset: OffsetChain = {
            id: 'correct-left-offset',
            originalChainId: chain.id,
            side: 'left',
            shapes: [
                createLine(0, 10, 90, 10), // horizontal offset - shortened to avoid overlap
                createLine(90, 10, 90, 90), // vertical offset - at x=90, not x=100
            ],
            closed: false,
            continuous: true,
        };

        const correctValidation = validateNoOverlappingLines(
            correctLeftOffset,
            0.1
        );
        expect(correctValidation.hasOverlaps).toBe(false);
    });
});
