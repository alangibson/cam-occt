import { describe, it, expect } from 'vitest';
import { calculatePolygonCentroid } from './functions';
import type { Point2D } from '$lib/geometry/point/interfaces';

describe('calculatePolygonCentroid', () => {
    it('should return origin for empty array', () => {
        const result = calculatePolygonCentroid([]);
        expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should return the point itself for single point', () => {
        const points: Point2D[] = [{ x: 5, y: 10 }];
        const result = calculatePolygonCentroid(points);
        expect(result).toEqual({ x: 5, y: 10 });
    });

    it('should calculate centroid of a triangle', () => {
        // Triangle with vertices at (0,0), (6,0), (3,6)
        // Centroid should be at (3, 2)
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 3, y: 6 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(3, 5);
        expect(result.y).toBeCloseTo(2, 5);
    });

    it('should calculate centroid of a square', () => {
        // Square with corners at (0,0), (10,0), (10,10), (0,10)
        // Centroid should be at (5, 5)
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(5, 5);
        expect(result.y).toBeCloseTo(5, 5);
    });

    it('should calculate centroid of a rectangle', () => {
        // Rectangle with corners at (0,0), (20,0), (20,10), (0,10)
        // Centroid should be at (10, 5)
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
            { x: 0, y: 10 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(10, 5);
        expect(result.y).toBeCloseTo(5, 5);
    });

    it('should handle counter-clockwise winding', () => {
        // Same square as before but counter-clockwise
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(5, 5);
        expect(result.y).toBeCloseTo(5, 5);
    });

    it('should handle degenerate polygon with collinear points', () => {
        // Three collinear points - should return arithmetic mean
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(5, 5);
        expect(result.y).toBeCloseTo(0, 5);
    });

    it('should calculate centroid of L-shaped polygon', () => {
        // L-shape: base 10x4, vertical part 4x6 on left side
        // Total area = 40 + 24 = 64
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 4 },
            { x: 4, y: 4 },
            { x: 4, y: 10 },
            { x: 0, y: 10 },
        ];
        const result = calculatePolygonCentroid(points);
        // Expected centroid can be calculated as weighted average of two rectangles:
        // Rectangle 1 (base): 10x4 at center (5, 2), area = 40
        // Rectangle 2 (vertical): 4x6 at center (2, 7), area = 24
        // Cx = (40*5 + 24*2) / 64 = (200 + 48) / 64 = 248/64 = 3.875
        // Cy = (40*2 + 24*7) / 64 = (80 + 168) / 64 = 248/64 = 3.875
        expect(result.x).toBeCloseTo(3.875, 5);
        expect(result.y).toBeCloseTo(3.875, 5);
    });

    it('should handle polygon with negative coordinates', () => {
        // Square centered at origin
        const points: Point2D[] = [
            { x: -5, y: -5 },
            { x: 5, y: -5 },
            { x: 5, y: 5 },
            { x: -5, y: 5 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(0, 5);
        expect(result.y).toBeCloseTo(0, 5);
    });

    it('should calculate centroid of a regular hexagon', () => {
        // Regular hexagon centered at origin with radius 10
        const points: Point2D[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            points.push({
                x: 10 * Math.cos(angle),
                y: 10 * Math.sin(angle),
            });
        }
        const result = calculatePolygonCentroid(points);
        // Centroid should be at origin (0, 0)
        expect(result.x).toBeCloseTo(0, 5);
        expect(result.y).toBeCloseTo(0, 5);
    });

    it('should handle offset square', () => {
        // Square offset from origin: (100,100) to (110,110)
        // Centroid should be at (105, 105)
        const points: Point2D[] = [
            { x: 100, y: 100 },
            { x: 110, y: 100 },
            { x: 110, y: 110 },
            { x: 100, y: 110 },
        ];
        const result = calculatePolygonCentroid(points);
        expect(result.x).toBeCloseTo(105, 5);
        expect(result.y).toBeCloseTo(105, 5);
    });
});
