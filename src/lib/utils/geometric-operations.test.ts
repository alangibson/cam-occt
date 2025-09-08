import { describe, it, expect } from 'vitest';
import {
    isChainGeometricallyContained,
    isPointInPolygon,
    calculatePolygonArea,
    calculatePolygonCentroid,
    calculatePolygonBounds,
} from './geometric-operations';
import { GeometryType } from '$lib/types/geometry';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type {
    Shape,
    Line,
    Circle,
    Arc,
    Ellipse,
    Spline,
    Polyline,
} from '../../lib/types';

// Helper function to create test chains
function createTestChain(id: string, shapes: Shape[]): Chain {
    return {
        id,
        shapes,
    };
}

// Helper function to create test rectangle
function createRectangle(
    x: number,
    y: number,
    width: number,
    height: number
): Shape[] {
    return [
        {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x, y },
                end: { x: x + width, y },
            } as Line,
        },
        {
            id: '2',
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y },
                end: { x: x + width, y: y + height },
            } as Line,
        },
        {
            id: '3',
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y: y + height },
                end: { x, y: y + height },
            } as Line,
        },
        {
            id: '4',
            type: GeometryType.LINE,
            geometry: {
                start: { x, y: y + height },
                end: { x, y },
            } as Line,
        },
    ];
}

// Helper function to create test circle
function createCircle(id: string, x: number, y: number, radius: number): Shape {
    return {
        id,
        type: GeometryType.CIRCLE,
        geometry: {
            center: { x, y },
            radius,
        } as Circle,
    };
}

// Helper function to create test arc
function createArc(
    id: string,
    center: { x: number; y: number },
    radius: number,
    startAngle: number,
    endAngle: number,
    clockwise: boolean = false
): Shape {
    return {
        id,
        type: GeometryType.ARC,
        geometry: {
            center,
            radius,
            startAngle,
            endAngle,
            clockwise,
        } as Arc,
    };
}

// Helper function to create test ellipse
function createEllipse(
    id: string,
    center: { x: number; y: number },
    majorAxisEndpoint: { x: number; y: number },
    minorToMajorRatio: number,
    startParam?: number,
    endParam?: number
): Shape {
    return {
        id,
        type: GeometryType.ELLIPSE,
        geometry: {
            center,
            majorAxisEndpoint,
            minorToMajorRatio,
            ...(startParam !== undefined && { startParam }),
            ...(endParam !== undefined && { endParam }),
        } as Ellipse,
    };
}

// Helper function to create test spline
function createSpline(
    id: string,
    controlPoints: { x: number; y: number }[],
    degree: number = 3
): Shape {
    return {
        id,
        type: GeometryType.SPLINE,
        geometry: {
            controlPoints,
            knots: [],
            weights: [],
            degree,
            fitPoints: controlPoints, // Use control points as fit points for testing
            closed: false,
        } as Spline,
    };
}

describe('isChainGeometricallyContained', () => {
    it('should detect small rectangle contained in large rectangle', () => {
        const outerShapes = createRectangle(0, 0, 20, 20);
        const innerShapes = createRectangle(5, 5, 10, 10);
        const outerChain = createTestChain('outer', outerShapes);
        const innerChain = createTestChain('inner', innerShapes);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should detect when rectangles do not contain each other', () => {
        const rect1Shapes = createRectangle(0, 0, 10, 10);
        const rect2Shapes = createRectangle(20, 20, 10, 10);
        const chain1 = createTestChain('chain1', rect1Shapes);
        const chain2 = createTestChain('chain2', rect2Shapes);

        expect(isChainGeometricallyContained(chain1, chain2)).toBe(false);
        expect(isChainGeometricallyContained(chain2, chain1)).toBe(false);
    });

    it('should handle circles correctly', () => {
        const outerCircle = createCircle('outer', 0, 0, 10);
        const innerCircle = createCircle('inner', 0, 0, 5);
        const outerChain = createTestChain('outer', [outerCircle]);
        const innerChain = createTestChain('inner', [innerCircle]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle arcs correctly', () => {
        const outerCircle = createCircle('outer', 0, 0, 10);
        const innerArc = createArc(
            'inner',
            { x: 0, y: 0 },
            5,
            0,
            Math.PI,
            false
        );
        const outerChain = createTestChain('outer', [outerCircle]);
        const innerChain = createTestChain('inner', [innerArc]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle clockwise arcs', () => {
        const outerCircle = createCircle('outer', 0, 0, 10);
        const innerArc = createArc(
            'inner',
            { x: 0, y: 0 },
            5,
            Math.PI,
            0,
            true
        );
        const outerChain = createTestChain('outer', [outerCircle]);
        const innerChain = createTestChain('inner', [innerArc]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle ellipses correctly', () => {
        const outerEllipse = createEllipse(
            'outer',
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            0.5
        );
        const innerEllipse = createEllipse(
            'inner',
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            0.5
        );
        const outerChain = createTestChain('outer', [outerEllipse]);
        const innerChain = createTestChain('inner', [innerEllipse]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle ellipse arcs', () => {
        const outerEllipse = createEllipse(
            'outer',
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            0.5
        );
        const innerEllipseArc = createEllipse(
            'inner',
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            0.5,
            0,
            Math.PI
        );
        const outerChain = createTestChain('outer', [outerEllipse]);
        const innerChain = createTestChain('inner', [innerEllipseArc]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle splines with NURBS evaluation', () => {
        const outerRect = createRectangle(0, 0, 20, 20);
        const innerSpline = createSpline('inner', [
            { x: 5, y: 5 },
            { x: 10, y: 8 },
            { x: 15, y: 5 },
            { x: 10, y: 2 },
        ]);
        const outerChain = createTestChain('outer', outerRect);
        const innerChain = createTestChain('inner', [innerSpline]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle splines that fallback to fit points', () => {
        const outerRect = createRectangle(0, 0, 20, 20);
        const splineWithBadNURBS: Shape = {
            id: 'bad-spline',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [], // Empty control points to force NURBS failure
                knots: [],
                weights: [],
                degree: 3,
                fitPoints: [
                    { x: 5, y: 5 },
                    { x: 15, y: 5 },
                    { x: 15, y: 15 },
                    { x: 5, y: 15 },
                ],
                closed: false,
            } as Spline,
        };
        const outerChain = createTestChain('outer', outerRect);
        const innerChain = createTestChain('inner', [splineWithBadNURBS]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle splines that fallback to control points', () => {
        const outerRect = createRectangle(0, 0, 20, 20);
        const splineWithNoFitPoints: Shape = {
            id: 'no-fit-points-spline',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [
                    { x: 5, y: 5 },
                    { x: 15, y: 5 },
                    { x: 15, y: 15 },
                    { x: 5, y: 15 },
                ],
                knots: [],
                weights: [],
                degree: 3,
                fitPoints: [], // Empty fit points
                closed: false,
            } as Spline,
        };
        const outerChain = createTestChain('outer', outerRect);
        const innerChain = createTestChain('inner', [splineWithNoFitPoints]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should handle polylines', () => {
        const outerRect = createRectangle(0, 0, 20, 20);
        const polyline: Shape = {
            id: 'polyline',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: createRectangle(5, 5, 10, 10), // Inner rectangle as polyline shapes
            } as Polyline,
        };
        const outerChain = createTestChain('outer', outerRect);
        const innerChain = createTestChain('inner', [polyline]);

        expect(isChainGeometricallyContained(innerChain, outerChain)).toBe(
            true
        );
    });

    it('should throw error for chains that cannot form polygons', () => {
        const emptyChain = createTestChain('empty', []);
        const validChain = createTestChain(
            'valid',
            createRectangle(0, 0, 10, 10)
        );

        expect(() => {
            isChainGeometricallyContained(emptyChain, validChain);
        }).toThrow(/Failed to extract polygons/);
    });

    it('should throw error for chains with insufficient points', () => {
        const singleLineShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ];
        const singleLineChain = createTestChain('single', singleLineShapes);
        const validChain = createTestChain(
            'valid',
            createRectangle(0, 0, 10, 10)
        );

        expect(() => {
            isChainGeometricallyContained(singleLineChain, validChain);
        }).toThrow(/Failed to extract polygons/);
    });

    it('should handle mixed shape types in same chain', () => {
        const outerRect = createRectangle(0, 0, 100, 100);
        const mixedShapes = [
            createCircle('circle', 20, 20, 5),
            ...createRectangle(30, 30, 10, 10),
        ];

        const outerChain = createTestChain('outer', outerRect);
        const mixedChain = createTestChain('mixed', mixedShapes);

        // This tests the duplicate point removal and polygon extraction logic
        expect(isChainGeometricallyContained(mixedChain, outerChain)).toBe(
            true
        );
    });
});

describe('isPointInPolygon', () => {
    it('should detect point inside polygon', () => {
        const polygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(isPointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    });

    it('should detect point outside polygon', () => {
        const polygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(isPointInPolygon({ x: 15, y: 5 }, polygon)).toBe(false);
    });

    it('should handle point on polygon boundary', () => {
        const polygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        // Point on edge behavior depends on the ray casting implementation
        const result = isPointInPolygon({ x: 5, y: 0 }, polygon);
        expect(typeof result).toBe('boolean');
    });
});

describe('calculatePolygonArea', () => {
    it('should calculate area of square correctly', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(Math.abs(calculatePolygonArea(square))).toBeCloseTo(100, 1);
    });

    it('should calculate area of triangle correctly', () => {
        const triangle = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 5, y: 10 },
        ];

        expect(Math.abs(calculatePolygonArea(triangle))).toBeCloseTo(50, 1);
    });

    it('should handle clockwise vs counterclockwise orientation', () => {
        const ccwSquare = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        const cwSquare = [
            { x: 0, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
        ];

        const area1 = calculatePolygonArea(ccwSquare);
        const area2 = calculatePolygonArea(cwSquare);

        // Both should have same magnitude regardless of orientation
        expect(Math.abs(area1)).toBeCloseTo(Math.abs(area2), 1);
        expect(Math.abs(area1)).toBeCloseTo(100, 1);
        expect(Math.abs(area2)).toBeCloseTo(100, 1);
    });
});

describe('calculatePolygonCentroid', () => {
    it('should calculate centroid of square correctly', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        const centroid = calculatePolygonCentroid(square);
        expect(centroid).not.toBeNull();
        expect(centroid!.x).toBeCloseTo(5, 1);
        expect(centroid!.y).toBeCloseTo(5, 1);
    });

    it('should calculate centroid of triangle correctly', () => {
        const triangle = [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 3, y: 6 },
        ];

        const centroid = calculatePolygonCentroid(triangle);
        expect(centroid).not.toBeNull();
        expect(centroid!.x).toBeCloseTo(3, 1);
        expect(centroid!.y).toBeCloseTo(2, 1);
    });

    it('should return null for polygon with insufficient points', () => {
        const twoPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ];

        expect(calculatePolygonCentroid(twoPoints)).toBeNull();
    });

    it('should return null for degenerate polygon (zero area)', () => {
        const degeneratePolygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 0 },
        ];

        const centroid = calculatePolygonCentroid(degeneratePolygon);
        expect(centroid).toBeNull();
    });

    it('should handle different polygon orientations', () => {
        const ccwSquare = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        const cwSquare = [
            { x: 0, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
        ];

        const centroid1 = calculatePolygonCentroid(ccwSquare);
        const centroid2 = calculatePolygonCentroid(cwSquare);

        expect(centroid1).not.toBeNull();
        expect(centroid2).not.toBeNull();
        expect(centroid1!.x).toBeCloseTo(centroid2!.x, 1);
        expect(centroid1!.y).toBeCloseTo(centroid2!.y, 1);
    });
});

describe('calculatePolygonBounds', () => {
    it('should calculate bounds of square correctly', () => {
        const square = [
            { x: 2, y: 3 },
            { x: 12, y: 3 },
            { x: 12, y: 13 },
            { x: 2, y: 13 },
        ];

        const bounds = calculatePolygonBounds(square);
        expect(bounds).not.toBeNull();
        expect(bounds!.min.x).toBe(2);
        expect(bounds!.min.y).toBe(3);
        expect(bounds!.max.x).toBe(12);
        expect(bounds!.max.y).toBe(13);
    });

    it('should calculate bounds of triangle correctly', () => {
        const triangle = [
            { x: 0, y: 5 },
            { x: 10, y: 2 },
            { x: 5, y: 15 },
        ];

        const bounds = calculatePolygonBounds(triangle);
        expect(bounds).not.toBeNull();
        expect(bounds!.min.x).toBe(0);
        expect(bounds!.min.y).toBe(2);
        expect(bounds!.max.x).toBe(10);
        expect(bounds!.max.y).toBe(15);
    });

    it('should return null for empty polygon', () => {
        expect(calculatePolygonBounds([])).toBeNull();
    });

    it('should handle single point polygon', () => {
        const singlePoint = [{ x: 5, y: 7 }];

        const bounds = calculatePolygonBounds(singlePoint);
        expect(bounds).not.toBeNull();
        expect(bounds!.min.x).toBe(5);
        expect(bounds!.min.y).toBe(7);
        expect(bounds!.max.x).toBe(5);
        expect(bounds!.max.y).toBe(7);
    });

    it('should handle polygon with negative coordinates', () => {
        const polygon = [
            { x: -10, y: -5 },
            { x: -2, y: -8 },
            { x: 3, y: -1 },
        ];

        const bounds = calculatePolygonBounds(polygon);
        expect(bounds).not.toBeNull();
        expect(bounds!.min.x).toBe(-10);
        expect(bounds!.min.y).toBe(-8);
        expect(bounds!.max.x).toBe(3);
        expect(bounds!.max.y).toBe(-1);
    });
});
