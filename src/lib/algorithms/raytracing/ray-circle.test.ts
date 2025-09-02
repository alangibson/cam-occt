/**
 * Tests for ray-circle intersection algorithms
 */

import { describe, it, expect } from 'vitest';
import type { Circle, Point2D } from '../../types/geometry';
import type { Ray } from './types';
import { 
  countRayCircleCrossings, 
  findRayCircleIntersections,
  countHorizontalRayCircleCrossings,
  isPointOnCircle 
} from './ray-circle';

describe('Ray-Circle Intersection', () => {
  const unitCircle: Circle = { center: { x: 0, y: 0 }, radius: 1 };
  const circleAt5: Circle = { center: { x: 5, y: 3 }, radius: 2 };
  
  describe('countRayCircleCrossings', () => {
    it('should return 0 when ray misses circle', () => {
      const ray: Ray = { origin: { x: -2, y: 2 }, direction: { x: 1, y: 0 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(0);
    });

    it('should return 2 when ray intersects circle', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: 1, y: 0 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(2);
    });

    it('should return 1 when ray is tangent to circle', () => {
      const ray: Ray = { origin: { x: -2, y: 1 }, direction: { x: 1, y: 0 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(1);
    });

    it('should return 2 when ray passes through center', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: 1, y: 0 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(2);
    });

    it('should handle ray starting inside circle', () => {
      const ray: Ray = { origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(1);
    });

    it('should handle ray starting on circle boundary', () => {
      const ray: Ray = { origin: { x: 1, y: 0 }, direction: { x: 1, y: 0 } };
      // Ray starting exactly on boundary should count as one crossing (numerical precision)
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(1);
    });

    it('should handle diagonal ray through circle', () => {
      const ray: Ray = { origin: { x: -2, y: -2 }, direction: { x: 1, y: 1 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(2);
    });

    it('should handle vertical ray', () => {
      const ray: Ray = { origin: { x: 0, y: -2 }, direction: { x: 0, y: 1 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(2);
    });

    it('should handle ray pointing away from circle', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: -1, y: 0 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(0);
    });
  });

  describe('findRayCircleIntersections', () => {
    it('should return empty array when ray misses circle', () => {
      const ray: Ray = { origin: { x: -2, y: 2 }, direction: { x: 1, y: 0 } };
      const intersections = findRayCircleIntersections(ray, unitCircle);
      expect(intersections).toHaveLength(0);
    });

    it('should return two intersections when ray crosses circle', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: 1, y: 0 } };
      const intersections = findRayCircleIntersections(ray, unitCircle);
      
      expect(intersections).toHaveLength(2);
      expect(intersections[0].point.x).toBeCloseTo(-1, 10);
      expect(intersections[0].point.y).toBeCloseTo(0, 10);
      expect(intersections[1].point.x).toBeCloseTo(1, 10);
      expect(intersections[1].point.y).toBeCloseTo(0, 10);
    });

    it('should return one intersection when ray is tangent', () => {
      const ray: Ray = { origin: { x: -2, y: 1 }, direction: { x: 1, y: 0 } };
      const intersections = findRayCircleIntersections(ray, unitCircle);
      
      expect(intersections).toHaveLength(1);
      expect(intersections[0].point.x).toBeCloseTo(0, 10);
      expect(intersections[0].point.y).toBeCloseTo(1, 10);
      expect(intersections[0].type).toBe('tangent');
    });

    it('should calculate correct t values', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: 1, y: 0 } };
      const intersections = findRayCircleIntersections(ray, unitCircle);
      
      expect(intersections[0].t).toBeCloseTo(1, 10); // First intersection at t=1
      expect(intersections[1].t).toBeCloseTo(3, 10); // Second intersection at t=3
    });

    it('should handle circle not at origin', () => {
      const ray: Ray = { origin: { x: 2, y: 3 }, direction: { x: 1, y: 0 } };
      const intersections = findRayCircleIntersections(ray, circleAt5);
      
      expect(intersections).toHaveLength(2);
      expect(intersections[0].point.x).toBeCloseTo(3, 10);
      expect(intersections[0].point.y).toBeCloseTo(3, 10);
      expect(intersections[1].point.x).toBeCloseTo(7, 10);
      expect(intersections[1].point.y).toBeCloseTo(3, 10);
    });

    it('should calculate shape parameters correctly', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: 1, y: 0 } };
      const intersections = findRayCircleIntersections(ray, unitCircle);
      
      // First intersection at (-1, 0) should have angle π (0.5 normalized)
      expect(intersections[0].shapeParameter).toBeCloseTo(0.5, 5);
      // Second intersection at (1, 0) should have angle 0 (0.0 normalized)
      expect(intersections[1].shapeParameter).toBeCloseTo(0.0, 5);
    });
  });

  describe('countHorizontalRayCircleCrossings', () => {
    it('should return 0 when ray is above circle', () => {
      const rayOrigin: Point2D = { x: -2, y: 2 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(0);
    });

    it('should return 0 when ray is below circle', () => {
      const rayOrigin: Point2D = { x: -2, y: -2 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(0);
    });

    it('should return 2 when ray passes through circle center', () => {
      const rayOrigin: Point2D = { x: -2, y: 0 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(2);
    });

    it('should return 1 when ray is tangent to top of circle', () => {
      const rayOrigin: Point2D = { x: -2, y: 1 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(1);
    });

    it('should return 1 when ray is tangent to bottom of circle', () => {
      const rayOrigin: Point2D = { x: -2, y: -1 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(1);
    });

    it('should return 0 when ray origin is to the right of circle', () => {
      const rayOrigin: Point2D = { x: 2, y: 0 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(0);
    });

    it('should return 1 when ray starts inside circle', () => {
      const rayOrigin: Point2D = { x: 0, y: 0 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(1);
    });

    it('should handle circle not at origin', () => {
      const rayOrigin: Point2D = { x: 2, y: 3 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, circleAt5)).toBe(2);
    });

    it('should return 0 when ray starts to the right of non-origin circle', () => {
      const rayOrigin: Point2D = { x: 8, y: 3 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, circleAt5)).toBe(0);
    });

    it('should handle ray starting on circle boundary', () => {
      const rayOrigin: Point2D = { x: 1, y: 0 };
      expect(countHorizontalRayCircleCrossings(rayOrigin, unitCircle)).toBe(0);
    });
  });

  describe('isPointOnCircle', () => {
    it('should return true for point on circle boundary', () => {
      const point: Point2D = { x: 1, y: 0 };
      expect(isPointOnCircle(point, unitCircle)).toBe(true);
    });

    it('should return true for point on top of circle', () => {
      const point: Point2D = { x: 0, y: 1 };
      expect(isPointOnCircle(point, unitCircle)).toBe(true);
    });

    it('should return true for point on bottom of circle', () => {
      const point: Point2D = { x: 0, y: -1 };
      expect(isPointOnCircle(point, unitCircle)).toBe(true);
    });

    it('should return false for point inside circle', () => {
      const point: Point2D = { x: 0, y: 0 };
      expect(isPointOnCircle(point, unitCircle)).toBe(false);
    });

    it('should return false for point outside circle', () => {
      const point: Point2D = { x: 2, y: 0 };
      expect(isPointOnCircle(point, unitCircle)).toBe(false);
    });

    it('should handle circle not at origin', () => {
      const point: Point2D = { x: 7, y: 3 };
      expect(isPointOnCircle(point, circleAt5)).toBe(true);
    });

    it('should handle points very close to circle boundary', () => {
      const point: Point2D = { x: 1.0000001, y: 0 };
      // Point is too far from boundary for default epsilon
      expect(isPointOnCircle(point, unitCircle)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero-radius circle', () => {
      const pointCircle: Circle = { center: { x: 0, y: 0 }, radius: 0 };
      const ray: Ray = { origin: { x: -1, y: 0 }, direction: { x: 1, y: 0 } };
      
      // Zero-radius circle acts like a point, ray passes through it
      expect(countRayCircleCrossings(ray, pointCircle)).toBe(1);
    });

    it('should handle very small circle', () => {
      const tinyCircle: Circle = { center: { x: 0, y: 0 }, radius: 1e-10 };
      const ray: Ray = { origin: { x: -1, y: 0 }, direction: { x: 1, y: 0 } };
      
      // Very small radius behaves like a point due to numerical precision
      expect(countRayCircleCrossings(ray, tinyCircle)).toBe(1);
    });

    it('should handle very large circle', () => {
      const largeCircle: Circle = { center: { x: 0, y: 0 }, radius: 1e6 };
      const ray: Ray = { origin: { x: -1e7, y: 0 }, direction: { x: 1, y: 0 } };
      
      expect(countRayCircleCrossings(ray, largeCircle)).toBe(2);
    });

    it('should handle nearly horizontal ray', () => {
      const ray: Ray = { origin: { x: -2, y: 0 }, direction: { x: 1, y: 1e-10 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(2);
    });

    it('should handle nearly vertical ray', () => {
      const ray: Ray = { origin: { x: 0, y: -2 }, direction: { x: 1e-10, y: 1 } };
      expect(countRayCircleCrossings(ray, unitCircle)).toBe(2);
    });
  });
});