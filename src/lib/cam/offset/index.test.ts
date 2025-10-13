/**
 * Unit Tests for Clipper2-Based Offset System
 */

import { describe, it, expect } from 'vitest';
import { offsetChain, getClipper2 } from './index';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape';
import type { Line, Arc } from '$lib/types/geometry';
import type { Point2D } from '$lib/types';

/**
 * Helper to extract all points from a chain's shapes
 */
function getAllPoints(chain: Chain): Point2D[] {
    const points: Point2D[] = [];
    for (const shape of chain.shapes) {
        if (shape.type === GeometryType.LINE) {
            const line = shape.geometry as Line;
            points.push(line.start);
            // Only add end point if it's the last shape to avoid duplicates
            if (shape === chain.shapes[chain.shapes.length - 1]) {
                points.push(line.end);
            }
        }
    }
    return points;
}

/**
 * Helper to calculate bounding box of points
 */
function getBoundingBox(points: Point2D[]) {
    if (points.length === 0) return null;
    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
    }

    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

describe('Clipper2 Offset System', () => {
    describe('WASM Initialization', () => {
        it('initializes Clipper2 WASM module', async () => {
            const clipper = await getClipper2();
            expect(clipper).toBeDefined();
            expect(clipper.InflatePaths64).toBeDefined();
            expect(clipper.JoinType).toBeDefined();
            expect(clipper.EndType).toBeDefined();
        });
    });

    describe('offsetChain - Closed Chains', () => {
        it('offsets closed square chain', async () => {
            const chain: Chain = {
                id: 'test-square',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        } as Line,
                    },
                    {
                        id: '4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 10);

            expect(result.success).toBe(true);
            expect(result.innerChain).toBeDefined();
            expect(result.outerChain).toBeDefined();
            expect(result.innerChain!.shapes.length).toBeGreaterThan(0);
            expect(result.outerChain!.shapes.length).toBeGreaterThan(0);
            expect(result.innerChain!.side).toBe('inner');
            expect(result.outerChain!.side).toBe('outer');
            expect(result.innerChain!.closed).toBe(true);
            expect(result.outerChain!.closed).toBe(true);
            expect(result.innerChain!.continuous).toBe(true);
            expect(result.outerChain!.continuous).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics).toBeDefined();
            expect(result.metrics!.totalShapes).toBe(4);
        });

        it('offsets closed chain with arc', async () => {
            const chain: Chain = {
                id: 'test-arc-chain',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 50, y: 50 },
                            radius: 30,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false,
                        } as Arc,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 80, y: 50 },
                            end: { x: 20, y: 50 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 5);

            expect(result.success).toBe(true);
            expect(result.innerChain).toBeDefined();
            expect(result.outerChain).toBeDefined();
            // Arc should be tessellated to lines
            expect(result.innerChain!.shapes[0].type).toBe(GeometryType.LINE);
        });
    });

    describe('offsetChain - Open Chains', () => {
        it('offsets open line chain', async () => {
            const chain: Chain = {
                id: 'test-line',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 10);

            expect(result.success).toBe(true);
            expect(result.innerChain).toBeDefined(); // left side
            expect(result.outerChain).toBeDefined(); // right side
            expect(result.innerChain!.side).toBe('left');
            expect(result.outerChain!.side).toBe('right');
            expect(result.innerChain!.closed).toBe(false);
            expect(result.outerChain!.closed).toBe(false);
        });

        it('offsets multi-segment open chain', async () => {
            const chain: Chain = {
                id: 'test-polyline',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 50, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 50, y: 0 },
                            end: { x: 50, y: 50 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 50, y: 50 },
                            end: { x: 100, y: 50 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 5);

            expect(result.success).toBe(true);
            expect(result.innerChain!.shapes.length).toBeGreaterThan(0);
            expect(result.outerChain!.shapes.length).toBeGreaterThan(0);
        });
    });

    describe('offsetChain - Edge Cases', () => {
        it('handles zero distance', async () => {
            const chain: Chain = {
                id: 'test-zero',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 0);

            // Even with zero distance, Clipper2 should succeed
            expect(result.success).toBe(true);
        });

        it('handles small offset distance', async () => {
            const chain: Chain = {
                id: 'test-small',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 0.1);

            expect(result.success).toBe(true);
            expect(result.innerChain).toBeDefined();
            expect(result.outerChain).toBeDefined();
        });

        it('handles large offset distance', async () => {
            const chain: Chain = {
                id: 'test-large',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 100);

            expect(result.success).toBe(true);
        });

        it('provides meaningful metrics', async () => {
            const chain: Chain = {
                id: 'test-metrics',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 10);

            expect(result.metrics).toBeDefined();
            expect(result.metrics!.totalShapes).toBe(1);
            expect(result.metrics!.processingTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.metrics!.intersectionsFound).toBe(0); // N/A for Clipper2
            expect(result.metrics!.gapsFilled).toBe(0); // N/A for Clipper2
        });
    });

    describe('Output Format', () => {
        it('always outputs line shapes', async () => {
            const chain: Chain = {
                id: 'test-output',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 50, y: 50 },
                            radius: 30,
                            startAngle: 0,
                            endAngle: Math.PI / 2,
                            clockwise: false,
                        } as Arc,
                    },
                ],
            };

            const result = await offsetChain(chain, 5);

            expect(result.success).toBe(true);
            expect(
                result.innerChain!.shapes.every(
                    (s) => s.type === GeometryType.LINE
                )
            ).toBe(true);
            expect(
                result.outerChain!.shapes.every(
                    (s) => s.type === GeometryType.LINE
                )
            ).toBe(true);
        });

        it('generates unique IDs for output shapes', async () => {
            const chain: Chain = {
                id: 'test-ids',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 10);

            const innerIds = result.innerChain!.shapes.map((s) => s.id);
            const outerIds = result.outerChain!.shapes.map((s) => s.id);
            const allIds = [...innerIds, ...outerIds];

            // All IDs should be unique
            expect(new Set(allIds).size).toBe(allIds.length);
        });
    });

    describe('Geometric Verification - Closed Chains', () => {
        it('correctly offsets a 100x100 square by 10 units', async () => {
            // Create a 100x100 square (clockwise from bottom-left)
            const chain: Chain = {
                id: 'square-100',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        } as Line,
                    },
                    {
                        id: '4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 10);

            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);

            // Get all points from inner and outer chains
            const innerPoints = getAllPoints(result.innerChain!);
            const outerPoints = getAllPoints(result.outerChain!);

            expect(innerPoints.length).toBeGreaterThan(0);
            expect(outerPoints.length).toBeGreaterThan(0);

            // Verify bounding boxes
            const innerBox = getBoundingBox(innerPoints);
            const outerBox = getBoundingBox(outerPoints);

            expect(innerBox).toBeDefined();
            expect(outerBox).toBeDefined();

            // Inner offset should create an 80x80 square (100 - 2*10)
            // Allow some tolerance for discretization and corner handling
            expect(innerBox!.width).toBeGreaterThan(78);
            expect(innerBox!.width).toBeLessThan(82);
            expect(innerBox!.height).toBeGreaterThan(78);
            expect(innerBox!.height).toBeLessThan(82);

            // Outer offset should create a 120x120 square (100 + 2*10)
            expect(outerBox!.width).toBeGreaterThan(118);
            expect(outerBox!.width).toBeLessThan(122);
            expect(outerBox!.height).toBeGreaterThan(118);
            expect(outerBox!.height).toBeLessThan(122);

            // Inner should be inside outer
            expect(innerBox!.minX).toBeGreaterThan(outerBox!.minX);
            expect(innerBox!.maxX).toBeLessThan(outerBox!.maxX);
            expect(innerBox!.minY).toBeGreaterThan(outerBox!.minY);
            expect(innerBox!.maxY).toBeLessThan(outerBox!.maxY);
        });

        it('correctly offsets a rectangle with different width/height', async () => {
            // Create a 200x50 rectangle
            const chain: Chain = {
                id: 'rect-200x50',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 200, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 200, y: 0 },
                            end: { x: 200, y: 50 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 200, y: 50 },
                            end: { x: 0, y: 50 },
                        } as Line,
                    },
                    {
                        id: '4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 50 },
                            end: { x: 0, y: 0 },
                        } as Line,
                    },
                ],
            };

            const offsetDistance = 5;
            const result = await offsetChain(chain, offsetDistance);

            expect(result.success).toBe(true);

            const innerPoints = getAllPoints(result.innerChain!);
            const outerPoints = getAllPoints(result.outerChain!);

            const innerBox = getBoundingBox(innerPoints);
            const outerBox = getBoundingBox(outerPoints);

            // Inner: 200 - 2*5 = 190 wide, 50 - 2*5 = 40 tall
            expect(innerBox!.width).toBeGreaterThan(188);
            expect(innerBox!.width).toBeLessThan(192);
            expect(innerBox!.height).toBeGreaterThan(38);
            expect(innerBox!.height).toBeLessThan(42);

            // Outer: 200 + 2*5 = 210 wide, 50 + 2*5 = 60 tall
            expect(outerBox!.width).toBeGreaterThan(208);
            expect(outerBox!.width).toBeLessThan(212);
            expect(outerBox!.height).toBeGreaterThan(58);
            expect(outerBox!.height).toBeLessThan(62);
        });

        it('handles offset that completely shrinks a small shape', async () => {
            // Create a 10x10 square and offset by 10 (should shrink to nothing)
            const chain: Chain = {
                id: 'tiny-square',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 10, y: 10 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 10 },
                            end: { x: 0, y: 10 },
                        } as Line,
                    },
                    {
                        id: '4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 0, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 6);

            expect(result.success).toBe(true);

            // Inner offset should be empty or very small (offset larger than can fit)
            const innerPoints = getAllPoints(result.innerChain!);
            // Clipper2 should return empty result for impossible inward offset
            expect(innerPoints.length).toBe(0);

            // Outer offset should still work
            const outerPoints = getAllPoints(result.outerChain!);
            expect(outerPoints.length).toBeGreaterThan(0);
        });

        it('correctly offsets a triangle', async () => {
            // Create an equilateral-ish triangle
            const chain: Chain = {
                id: 'triangle',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 50, y: 86.6 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 50, y: 86.6 },
                            end: { x: 0, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 5);

            expect(result.success).toBe(true);
            expect(result.innerChain!.shapes.length).toBeGreaterThan(0);
            expect(result.outerChain!.shapes.length).toBeGreaterThan(0);

            const innerPoints = getAllPoints(result.innerChain!);
            const outerPoints = getAllPoints(result.outerChain!);
            const innerBox = getBoundingBox(innerPoints);
            const outerBox = getBoundingBox(outerPoints);

            // Inner triangle should be smaller
            expect(innerBox!.width).toBeLessThan(100);
            expect(innerBox!.height).toBeLessThan(86.6);

            // Outer triangle should be larger
            expect(outerBox!.width).toBeGreaterThan(100);
            expect(outerBox!.height).toBeGreaterThan(86.6);
        });
    });

    describe('Geometric Verification - Open Chains', () => {
        it('correctly offsets a horizontal line', async () => {
            const chain: Chain = {
                id: 'h-line',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 50 },
                            end: { x: 100, y: 50 },
                        } as Line,
                    },
                ],
            };

            const offsetDistance = 10;
            const result = await offsetChain(chain, offsetDistance);

            expect(result.success).toBe(true);

            const leftPoints = getAllPoints(result.innerChain!);
            const rightPoints = getAllPoints(result.outerChain!);

            expect(leftPoints.length).toBeGreaterThan(0);
            expect(rightPoints.length).toBeGreaterThan(0);

            // Both offsets should span roughly the same x range as original
            const leftBox = getBoundingBox(leftPoints);
            const rightBox = getBoundingBox(rightPoints);

            expect(leftBox!.width).toBeGreaterThan(95);
            expect(rightBox!.width).toBeGreaterThan(95);

            // At least one should be offset from the original y=50 line
            const leftOffset = Math.abs(leftBox!.minY - 50);
            const rightOffset = Math.abs(rightBox!.minY - 50);

            expect(Math.max(leftOffset, rightOffset)).toBeGreaterThan(8);
        });

        it('correctly offsets an L-shaped path', async () => {
            const chain: Chain = {
                id: 'l-shape',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 10);

            expect(result.success).toBe(true);

            const leftPoints = getAllPoints(result.innerChain!);
            const rightPoints = getAllPoints(result.outerChain!);

            expect(leftPoints.length).toBeGreaterThan(0);
            expect(rightPoints.length).toBeGreaterThan(0);

            // Both offsets should maintain the L-shape general structure
            const leftBox = getBoundingBox(leftPoints);
            const rightBox = getBoundingBox(rightPoints);

            // Both should cover roughly the same extent as the original
            expect(leftBox!.width).toBeGreaterThan(80);
            expect(leftBox!.height).toBeGreaterThan(80);
            expect(rightBox!.width).toBeGreaterThan(80);
            expect(rightBox!.height).toBeGreaterThan(80);
        });

        it('correctly offsets a zigzag path', async () => {
            const chain: Chain = {
                id: 'zigzag',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 50, y: 50 },
                        } as Line,
                    },
                    {
                        id: '2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 50, y: 50 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                    {
                        id: '3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 150, y: 50 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, 5);

            expect(result.success).toBe(true);

            const leftPoints = getAllPoints(result.innerChain!);
            const rightPoints = getAllPoints(result.outerChain!);

            expect(leftPoints.length).toBeGreaterThan(0);
            expect(rightPoints.length).toBeGreaterThan(0);

            // Should maintain zigzag structure
            const leftBox = getBoundingBox(leftPoints);
            const rightBox = getBoundingBox(rightPoints);

            expect(leftBox!.width).toBeGreaterThan(140);
            expect(rightBox!.width).toBeGreaterThan(140);
        });
    });

    describe('Arc Tessellation Verification', () => {
        it('tessellates arcs into smooth polylines', async () => {
            const chain: Chain = {
                id: 'arc-circle',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 50, y: 50 },
                            radius: 30,
                            startAngle: 0,
                            endAngle: 2 * Math.PI,
                            clockwise: false,
                        } as Arc,
                    },
                ],
            };

            const result = await offsetChain(chain, 5);

            expect(result.success).toBe(true);

            // Verify output is lines (tessellated from arcs)
            expect(result.innerChain!.shapes[0].type).toBe(GeometryType.LINE);
            expect(result.outerChain!.shapes[0].type).toBe(GeometryType.LINE);

            const innerPoints = getAllPoints(result.innerChain!);
            const outerPoints = getAllPoints(result.outerChain!);

            // Should have many points for smooth tessellation
            expect(innerPoints.length).toBeGreaterThan(16);
            expect(outerPoints.length).toBeGreaterThan(16);

            // Verify approximate circle dimensions
            const innerBox = getBoundingBox(innerPoints);
            const outerBox = getBoundingBox(outerPoints);

            // Inner circle: radius 30 - 5 = 25, diameter ≈ 50
            expect(innerBox!.width).toBeGreaterThan(48);
            expect(innerBox!.width).toBeLessThan(52);

            // Outer circle: radius 30 + 5 = 35, diameter ≈ 70
            expect(outerBox!.width).toBeGreaterThan(68);
            expect(outerBox!.width).toBeLessThan(72);
        });
    });

    describe('Error Handling', () => {
        it('handles empty chain gracefully', async () => {
            const chain: Chain = {
                id: 'empty',
                shapes: [],
            };

            const result = await offsetChain(chain, 10);

            // Should handle gracefully, even if it returns empty results
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        it('handles negative offset distance', async () => {
            const chain: Chain = {
                id: 'negative-test',
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        } as Line,
                    },
                ],
            };

            const result = await offsetChain(chain, -10);

            // Negative distance should be treated as abs() internally
            expect(result.success).toBe(true);
            expect(result.innerChain).toBeDefined();
            expect(result.outerChain).toBeDefined();
        });
    });
});
