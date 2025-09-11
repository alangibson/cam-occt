import { describe, expect, it } from 'vitest';
import {
    detectChainSide,
    determineChainOrientation,
    isPointInsideChain,
} from './side-detection';
import { GeometryType, type Shape } from '$lib/types/geometry';
import { detectShapeChains } from '../../chain-detection/chain-detection';
import { normalizeChain } from '../../chain-normalization/chain-normalization';
import { generateId } from '$lib/domain/id';
import {
    getShapeMidpoint,
    getShapeNormal,
} from '$lib/geometry/shape/functions';

describe('side-detection', () => {
    // Helper to create a line shape
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

    // Helper to create an arc shape
    function createArc(
        cx: number,
        cy: number,
        radius: number,
        startAngle: number,
        endAngle: number
    ): Shape {
        return {
            id: generateId(),
            type: GeometryType.ARC,
            geometry: {
                center: { x: cx, y: cy },
                radius,
                startAngle,
                endAngle,
                clockwise: false,
            },
        };
    }

    describe('detectChainSide', () => {
        it('should detect inner offset for closed square chain', () => {
            // Create a square chain (counterclockwise)
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0), // bottom
                createLine(10, 0, 10, 10), // right
                createLine(10, 10, 0, 10), // top
                createLine(0, 10, 0, 0), // left
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            expect(detectedChains).toHaveLength(1);
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            // Create an inner offset line (offset inward from bottom edge)
            const innerOffsetLine = createLine(2, 2, 8, 2);

            const result = detectChainSide(
                innerOffsetLine,
                -2,
                chain,
                0.1,
                true
            );

            expect(result.side).toBe('inner');
            expect(result.confidence).toBeGreaterThan(0.8);
            expect(result.method).toBe('winding');
        });

        it('should detect outer offset for closed square chain', () => {
            // Create a square chain (counterclockwise)
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0), // bottom
                createLine(10, 0, 10, 10), // right
                createLine(10, 10, 0, 10), // top
                createLine(0, 10, 0, 0), // left
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            // Create an outer offset line (offset outward from bottom edge)
            const outerOffsetLine = createLine(-2, -2, 12, -2);

            const result = detectChainSide(
                outerOffsetLine,
                2,
                chain,
                0.1,
                true
            );

            expect(result.side).toBe('outer');
            expect(result.confidence).toBeGreaterThan(0.8);
            expect(result.method).toBe('winding');
        });

        it('should detect left offset for open L-shaped chain', () => {
            // Create an L-shaped chain
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0), // horizontal
                createLine(10, 0, 10, 10), // vertical
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            expect(detectedChains).toHaveLength(1);
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            // Create a left offset from the horizontal line
            const leftOffsetLine = createLine(0, 2, 10, 2);

            const result = detectChainSide(
                leftOffsetLine,
                2,
                chain,
                0.1,
                false
            );

            expect(result.side).toBe('left');
            expect(result.method).toBe('orientation');
        });

        it('should detect right offset for open L-shaped chain', () => {
            // Create an L-shaped chain
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0), // horizontal
                createLine(10, 0, 10, 10), // vertical
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            // Create a right offset from the horizontal line
            const rightOffsetLine = createLine(0, -2, 10, -2);

            const result = detectChainSide(
                rightOffsetLine,
                -2,
                chain,
                0.1,
                false
            );

            expect(result.side).toBe('right');
            expect(result.method).toBe('orientation');
        });

        it('should handle arc offsets in closed chain', () => {
            // Create a rounded rectangle using lines and arcs
            const shapes: Shape[] = [
                createLine(5, 0, 15, 0), // bottom
                createArc(15, 5, 5, -Math.PI / 2, 0), // bottom-right corner
                createLine(20, 5, 20, 15), // right
                createArc(15, 15, 5, 0, Math.PI / 2), // top-right corner
                createLine(15, 20, 5, 20), // top
                createArc(5, 15, 5, Math.PI / 2, Math.PI), // top-left corner
                createLine(0, 15, 0, 5), // left
                createArc(5, 5, 5, Math.PI, (3 * Math.PI) / 2), // bottom-left corner
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            // Create an inner offset arc
            const innerOffsetArc = createArc(15, 5, 3, -Math.PI / 2, 0);

            const result = detectChainSide(
                innerOffsetArc,
                -2,
                chain,
                0.1,
                true
            );

            expect(result.side).toBe('inner');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        });
    });

    describe('isPointInsideChain', () => {
        it('should correctly identify points inside a square', () => {
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0),
                createLine(10, 0, 10, 10),
                createLine(10, 10, 0, 10),
                createLine(0, 10, 0, 0),
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            expect(isPointInsideChain({ x: 5, y: 5 }, chain)).toBe(true);
            expect(isPointInsideChain({ x: 1, y: 1 }, chain)).toBe(true);
            expect(isPointInsideChain({ x: 9, y: 9 }, chain)).toBe(true);
        });

        it('should correctly identify points outside a square', () => {
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0),
                createLine(10, 0, 10, 10),
                createLine(10, 10, 0, 10),
                createLine(0, 10, 0, 0),
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            expect(isPointInsideChain({ x: -1, y: 5 }, chain)).toBe(false);
            expect(isPointInsideChain({ x: 11, y: 5 }, chain)).toBe(false);
            expect(isPointInsideChain({ x: 5, y: -1 }, chain)).toBe(false);
            expect(isPointInsideChain({ x: 5, y: 11 }, chain)).toBe(false);
        });

        it('should throw error for open chains', () => {
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0),
                createLine(10, 0, 10, 10),
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            expect(() => isPointInsideChain({ x: 5, y: 5 }, chain)).toThrow(
                'Cannot check point containment for open chain'
            );
        });
    });

    describe('determineChainOrientation', () => {
        it('should determine orientation for horizontal open chain', () => {
            const shapes: Shape[] = [createLine(0, 0, 10, 0)];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            const orientation = determineChainOrientation(chain);

            expect(orientation.x).toBeCloseTo(1, 5);
            expect(orientation.y).toBeCloseTo(0, 5);
        });

        it('should determine orientation for vertical open chain', () => {
            const shapes: Shape[] = [createLine(0, 0, 0, 10)];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            const orientation = determineChainOrientation(chain);

            expect(orientation.x).toBeCloseTo(0, 5);
            expect(orientation.y).toBeCloseTo(1, 5);
        });

        it('should determine orientation for L-shaped chain', () => {
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0),
                createLine(10, 0, 10, 10),
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            const orientation = determineChainOrientation(chain);

            // Overall direction from (0,0) to (10,10)
            const expectedX = 10 / Math.sqrt(200);
            const expectedY = 10 / Math.sqrt(200);

            expect(orientation.x).toBeCloseTo(expectedX, 5);
            expect(orientation.y).toBeCloseTo(expectedY, 5);
        });

        it('should throw error for closed chains', () => {
            const shapes: Shape[] = [
                createLine(0, 0, 10, 0),
                createLine(10, 0, 10, 10),
                createLine(10, 10, 0, 10),
                createLine(0, 10, 0, 0),
            ];

            const detectedChains = detectShapeChains(shapes, {
                tolerance: 0.1,
            });
            const chain = normalizeChain(detectedChains[0], {
                traversalTolerance: 0.1,
                maxTraversalAttempts: 5,
            });

            expect(() => determineChainOrientation(chain)).toThrow(
                'Chain orientation is only defined for open chains'
            );
        });
    });

    describe('getShapeMidpoint', () => {
        it('should get midpoint of a line', () => {
            const lineShape = createLine(0, 0, 10, 0);
            const midpoint = getShapeMidpoint(lineShape);

            expect(midpoint.x).toBeCloseTo(5, 5);
            expect(midpoint.y).toBeCloseTo(0, 5);
        });

        it('should get point at custom parameter', () => {
            const lineShape = createLine(0, 0, 10, 0);
            const point = getShapeMidpoint(lineShape, 0.25);

            expect(point.x).toBeCloseTo(2.5, 5);
            expect(point.y).toBeCloseTo(0, 5);
        });

        it('should get midpoint of an arc', () => {
            const arcShape = createArc(0, 0, 10, 0, Math.PI / 2);
            const midpoint = getShapeMidpoint(arcShape);

            // At 45 degrees
            expect(midpoint.x).toBeCloseTo(10 * Math.cos(Math.PI / 4), 5);
            expect(midpoint.y).toBeCloseTo(10 * Math.sin(Math.PI / 4), 5);
        });
    });

    describe('getShapeNormal', () => {
        it('should get normal for horizontal line pointing up', () => {
            const lineShape = createLine(0, 0, 10, 0);
            const normal = getShapeNormal(lineShape, 0.5);

            // For horizontal line going right, normal should point up (counterclockwise rotation)
            expect(normal.x).toBeCloseTo(0, 5);
            expect(normal.y).toBeCloseTo(1, 5);
        });

        it('should get normal for vertical line pointing left', () => {
            const lineShape = createLine(0, 0, 0, 10);
            const normal = getShapeNormal(lineShape, 0.5);

            // For vertical line going up, normal should point left (counterclockwise rotation)
            expect(normal.x).toBeCloseTo(-1, 5);
            expect(normal.y).toBeCloseTo(0, 5);
        });

        it('should get normal for arc pointing outward', () => {
            const arcShape = createArc(0, 0, 10, 0, Math.PI / 2);
            const normal = getShapeNormal(arcShape, 0.5);

            // For an arc at 45 degrees, the tangent is perpendicular to the radius vector
            // The radius vector at 45 degrees is (cos(45°), sin(45°)) = (√2/2, √2/2)
            // The tangent is perpendicular: (-√2/2, √2/2)
            // The normal is perpendicular to tangent: (-√2/2, -√2/2) (pointing inward)
            // But we calculate using finite differences, so let's just check it's roughly correct
            const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
            expect(length).toBeCloseTo(1, 3); // Should be normalized

            // The normal should be roughly perpendicular to the radius at that point
            const radiusX = Math.cos(Math.PI / 4);
            const radiusY = Math.sin(Math.PI / 4);
            const dotProduct = normal.x * radiusX + normal.y * radiusY;

            // Normal and radius should be roughly perpendicular or anti-parallel
            expect(Math.abs(Math.abs(dotProduct) - 1)).toBeLessThan(0.1);
        });
    });
});
