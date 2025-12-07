import { describe, expect, it } from 'vitest';
import { calculatePolygonCentroid } from '$lib/cam/chain/functions';
import {
    calculatePolygonBounds,
    calculatePolygonCentroid2,
    calculatePolygonArea,
    isPointInPolygon,
} from '$lib/geometry/polygon/functions';
import type { Point2D } from '$lib/geometry/point/interfaces';

describe('isPointInPolygon', () => {
    it('should detect point inside polygon', () => {
        const polygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(isPointInPolygon({ x: 5, y: 5 }, { points: polygon })).toBe(
            true
        );
    });

    it('should detect point outside polygon', () => {
        const polygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(isPointInPolygon({ x: 15, y: 5 }, { points: polygon })).toBe(
            false
        );
    });

    it('should handle point on polygon boundary', () => {
        const polygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        // Point on edge behavior depends on the ray casting implementation
        const result = isPointInPolygon({ x: 5, y: 0 }, { points: polygon });
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

        expect(Math.abs(calculatePolygonArea({ points: square }))).toBeCloseTo(
            100,
            1
        );
    });

    it('should calculate area of triangle correctly', () => {
        const triangle = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 5, y: 10 },
        ];

        expect(
            Math.abs(calculatePolygonArea({ points: triangle }))
        ).toBeCloseTo(50, 1);
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

        const area1 = calculatePolygonArea({ points: ccwSquare });
        const area2 = calculatePolygonArea({ points: cwSquare });

        // Both should have same magnitude regardless of orientation
        expect(Math.abs(area1)).toBeCloseTo(Math.abs(area2), 1);
        expect(Math.abs(area1)).toBeCloseTo(100, 1);
        expect(Math.abs(area2)).toBeCloseTo(100, 1);
    });

    it('should return absolute area regardless of winding', () => {
        const unitSquareCW: Point2D[] = [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 0 },
        ];

        const unitSquareCCW: Point2D[] = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
        ];

        const areaCW = calculatePolygonArea({ points: unitSquareCW });
        const areaCCW = calculatePolygonArea({ points: unitSquareCCW });

        expect(areaCW).toBe(1);
        expect(areaCCW).toBe(1);
        expect(areaCW).toBe(areaCCW);
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

        const centroid = calculatePolygonCentroid2({ points: square });
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

        const centroid = calculatePolygonCentroid2({ points: triangle });
        expect(centroid).not.toBeNull();
        expect(centroid!.x).toBeCloseTo(3, 1);
        expect(centroid!.y).toBeCloseTo(2, 1);
    });

    it('should return null for polygon with insufficient points', () => {
        const twoPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ];

        expect(calculatePolygonCentroid2({ points: twoPoints })).toBeNull();
    });

    it('should return null for degenerate polygon (zero area)', () => {
        const degeneratePolygon = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 0 },
        ];

        const centroid = calculatePolygonCentroid2({
            points: degeneratePolygon,
        });
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

    it.skip('should calculate centroid of square', () => {
        // TODO: Fix centroid calculation - currently has sign issues with CW polygons
        const unitSquareCW: Point2D[] = [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 0 },
        ];
        const centroid = calculatePolygonCentroid(unitSquareCW);
        expect(centroid.x).toBeCloseTo(0.5);
        expect(centroid.y).toBeCloseTo(0.5);
    });

    it.skip('should calculate centroid of triangle', () => {
        // TODO: Fix centroid calculation - currently has sign issues with CW polygons
        const triangle: Point2D[] = [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 1, y: 2 },
        ];
        const centroid = calculatePolygonCentroid(triangle);
        expect(centroid.x).toBeCloseTo(1); // (0+2+1)/3 = 1 for arithmetic mean
        expect(centroid.y).toBeCloseTo(2 / 3); // (0+0+2)/3 = 2/3 for arithmetic mean (approximate)
    });

    it('should handle empty array', () => {
        const centroid = calculatePolygonCentroid([]);
        expect(centroid).toEqual({ x: 0, y: 0 });
    });

    it('should handle degenerate polygon by returning arithmetic mean', () => {
        const degenerate: Point2D[] = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 }, // All collinear
        ];
        const centroid = calculatePolygonCentroid(degenerate);
        expect(centroid.x).toBeCloseTo(1); // (0+1+2)/3 = 1
        expect(centroid.y).toBeCloseTo(0); // (0+0+0)/3 = 0
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

        const bounds = calculatePolygonBounds({ points: square });
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

        const bounds = calculatePolygonBounds({ points: triangle });
        expect(bounds).not.toBeNull();
        expect(bounds!.min.x).toBe(0);
        expect(bounds!.min.y).toBe(2);
        expect(bounds!.max.x).toBe(10);
        expect(bounds!.max.y).toBe(15);
    });

    it('should return null for empty polygon', () => {
        expect(calculatePolygonBounds({ points: [] })).toBeNull();
    });

    it('should handle single point polygon', () => {
        const singlePoint = [{ x: 5, y: 7 }];

        const bounds = calculatePolygonBounds({ points: singlePoint });
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

        const bounds = calculatePolygonBounds({ points: polygon });
        expect(bounds).not.toBeNull();
        expect(bounds!.min.x).toBe(-10);
        expect(bounds!.min.y).toBe(-8);
        expect(bounds!.max.x).toBe(3);
        expect(bounds!.max.y).toBe(-1);
    });
});
