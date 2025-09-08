import { describe, it, expect } from 'vitest';
import type { Shape, Line, Arc, Circle } from '../../../../lib/types/geometry';
import type { OffsetChain } from './types';
import { detectShapeChains } from '../../chain-detection/chain-detection';
import { normalizeChain } from '../../chain-normalization/chain-normalization';
import { generateId } from '../../../utils/id';

describe('offset chain connectivity validation', () => {
    // Helper to create shapes
    function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
        return {
            id: generateId(),
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
        endAngle: number
    ): Shape {
        return {
            id: generateId(),
            type: 'arc',
            geometry: {
                center: { x: cx, y: cy },
                radius,
                startAngle,
                endAngle,
                clockwise: false,
            },
        };
    }

    // Get endpoint of a shape
    function getShapeEndpoint(
        shape: Shape,
        isStart: boolean
    ): { x: number; y: number } {
        switch (shape.type) {
            case 'line': {
                const line: import('$lib/types/geometry').Line =
                    shape.geometry as Line;
                return isStart ? line.start : line.end;
            }
            case 'arc': {
                const arc: import('$lib/types/geometry').Arc =
                    shape.geometry as Arc;
                const angle: number = isStart ? arc.startAngle : arc.endAngle;
                return {
                    x: arc.center.x + arc.radius * Math.cos(angle),
                    y: arc.center.y + arc.radius * Math.sin(angle),
                };
            }
            case 'circle': {
                const circle: import('$lib/types/geometry').Circle =
                    shape.geometry as Circle;
                return circle.center;
            }
            default:
                return { x: 0, y: 0 };
        }
    }

    // Test if offset chain shapes are properly connected
    function validateOffsetChainConnectivity(
        offsetChain: OffsetChain,
        tolerance: number = 0.1
    ): {
        isConnected: boolean;
        gaps: Array<{
            shapeIndex1: number;
            shapeIndex2: number;
            distance: number;
            point1: { x: number; y: number };
            point2: { x: number; y: number };
        }>;
    } {
        const gaps: Array<{
            shapeIndex1: number;
            shapeIndex2: number;
            distance: number;
            point1: { x: number; y: number };
            point2: { x: number; y: number };
        }> = [];

        for (let i: number = 0; i < offsetChain.shapes.length; i++) {
            const currentShape = offsetChain.shapes[i];
            const nextIndex = offsetChain.closed
                ? (i + 1) % offsetChain.shapes.length
                : i + 1;

            if (nextIndex >= offsetChain.shapes.length) continue;

            const nextShape = offsetChain.shapes[nextIndex];

            const currentEnd = getShapeEndpoint(currentShape, false);
            const nextStart = getShapeEndpoint(nextShape, true);

            const distance: number = Math.sqrt(
                (currentEnd.x - nextStart.x) ** 2 +
                    (currentEnd.y - nextStart.y) ** 2
            );

            if (distance > tolerance) {
                gaps.push({
                    shapeIndex1: i,
                    shapeIndex2: nextIndex,
                    distance,
                    point1: currentEnd,
                    point2: nextStart,
                });
            }
        }

        return {
            isConnected: gaps.length === 0,
            gaps,
        };
    }

    it('should detect connectivity gaps in L-shaped offset chains', () => {
        // Create an L-shaped chain
        const shapes: Shape[] = [
            createLine(0, 0, 100, 0), // horizontal
            createLine(100, 0, 100, 80), // vertical
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.1,
            maxTraversalAttempts: 5,
        });

        // Create BROKEN right offset (the horizontal doesn't connect to vertical)
        const brokenRightOffset: OffsetChain = {
            id: 'broken-right-offset',
            originalChainId: chain.id,
            side: 'right',
            shapes: [
                createLine(0, -10, 100, -10), // horizontal ends at (100, -10)
                createLine(110, -10, 110, 80), // vertical starts at (110, -10) - GAP of 10 units!
            ],
            closed: false,
            continuous: true, // Claims to be continuous but isn't
        };

        const validation = validateOffsetChainConnectivity(
            brokenRightOffset,
            0.1
        );

        expect(validation.isConnected).toBe(false);
        expect(validation.gaps).toHaveLength(1);
        expect(validation.gaps[0].distance).toBeCloseTo(10, 1);
        expect(validation.gaps[0].point1).toEqual({ x: 100, y: -10 });
        expect(validation.gaps[0].point2).toEqual({ x: 110, y: -10 });
    });

    it('should validate properly connected L-shaped offset chains', () => {
        const shapes: Shape[] = [
            createLine(0, 0, 100, 0),
            createLine(100, 0, 100, 80),
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.1,
            maxTraversalAttempts: 5,
        });

        // Create CORRECT right offset
        const correctRightOffset: OffsetChain = {
            id: 'correct-right-offset',
            originalChainId: chain.id,
            side: 'right',
            shapes: [
                createLine(0, -10, 110, -10), // horizontal extends to connect: (100, -10) → (110, -10)
                createLine(110, -10, 110, 80), // vertical starts exactly where horizontal ends
            ],
            closed: false,
            continuous: true,
        };

        const validation = validateOffsetChainConnectivity(
            correctRightOffset,
            0.1
        );

        expect(validation.isConnected).toBe(true);
        expect(validation.gaps).toHaveLength(0);
    });

    it('should detect connectivity gaps in rounded rectangle chains', () => {
        // Test rounded rectangle with improper arc connections
        const shapes: Shape[] = [
            createLine(20, 0, 80, 0),
            createArc(80, 20, 20, -Math.PI / 2, 0),
            createLine(100, 20, 100, 80),
            createArc(80, 80, 20, 0, Math.PI / 2),
            createLine(80, 100, 20, 100),
            createArc(20, 80, 20, Math.PI / 2, Math.PI),
            createLine(0, 80, 0, 20),
            createArc(20, 20, 20, Math.PI, (3 * Math.PI) / 2),
        ];

        const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
        const chain = normalizeChain(detectedChains[0], {
            traversalTolerance: 0.1,
            maxTraversalAttempts: 5,
        });

        // Create BROKEN inner offset with gaps
        const brokenInnerOffset: OffsetChain = {
            id: 'broken-inner-offset',
            originalChainId: chain.id,
            side: 'inner',
            shapes: [
                createLine(25, 5, 75, 5), // ends at (75, 5)
                createArc(75, 20, 15, -Math.PI / 2, 0), // starts at (75, 5) - should connect
                createLine(95, 20, 95, 80), // starts at (95, 20) - WRONG! Arc ends at (90, 20)
                createArc(75, 80, 15, 0, Math.PI / 2), // starts at (90, 80) - GAP!
                createLine(75, 95, 25, 95),
                createArc(25, 80, 15, Math.PI / 2, Math.PI),
                createLine(10, 80, 10, 20),
                createArc(25, 20, 15, Math.PI, (3 * Math.PI) / 2),
            ],
            closed: true,
            continuous: true,
        };

        const validation = validateOffsetChainConnectivity(
            brokenInnerOffset,
            0.1
        );

        expect(validation.isConnected).toBe(false);
        expect(validation.gaps.length).toBeGreaterThan(0);

        // Should detect the gap between arc end (90, 20) and line start (95, 20)
        const arcToLineGap = validation.gaps.find(
            (gap) => gap.shapeIndex1 === 1 && gap.shapeIndex2 === 2
        );
        expect(arcToLineGap).toBeDefined();
        expect(arcToLineGap!.distance).toBeCloseTo(5, 1);
    });
});
