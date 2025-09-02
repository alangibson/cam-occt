/**
 * Ray-Tracing Utilities
 * 
 * Common utility functions for ray-shape intersection algorithms
 */

import type { Point2D } from '../../types/geometry';
import { solveQuadratic as mathSolveQuadratic, isNearlyEqual } from '../../utils/math-utils';
import { normalizeAngle } from '../../utils/polygon-geometry-shared';

// Re-export normalizeAngle from shared library for backward compatibility
export { normalizeAngle };

/**
 * Checks if two floating point numbers are approximately equal
 */
export function approxEqual(a: number, b: number, epsilon: number = 1e-10): boolean {
  return isNearlyEqual(a, b, epsilon);
}

/**
 * Checks if a value is between two bounds (inclusive)
 */
export function isBetween(value: number, min: number, max: number, epsilon: number = 1e-10): boolean {
  return value >= min - epsilon && value <= max + epsilon;
}

/**
 * Normalizes a 2D vector to unit length
 */
export function normalizeVector2D(vector: Point2D): Point2D {
  const length: number = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (length < 1e-10) {
    return { x: 0, y: 0 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

/**
 * Computes the dot product of two 2D vectors
 */
export function dot2D(v1: Point2D, v2: Point2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Computes the cross product of two 2D vectors (returns z-component)
 */
export function cross2D(v1: Point2D, v2: Point2D): number {
  return v1.x * v2.y - v1.y * v2.x;
}

/**
 * Checks if an angle is within an arc's angular range
 * Handles both clockwise and counter-clockwise arcs
 */
export function isAngleInArcRange(
  angle: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean = false
): boolean {
  // Normalize all angles to [0, 2π]
  const testAngle: number = normalizeAngle(angle);
  const start: number = normalizeAngle(startAngle);
  const end: number = normalizeAngle(endAngle);
  
  if (approxEqual(start, end)) {
    // Full circle
    return true;
  }
  
  if (clockwise) {
    // Clockwise: go from start to end in decreasing angle
    if (start >= end) {
      // No wrap around zero - clockwise from start to end
      return testAngle >= end && testAngle <= start;
    } else {
      // Wraps around zero - clockwise arc crosses 0
      return testAngle >= end || testAngle <= start;
    }
  } else {
    // Counter-clockwise: go from start to end in increasing angle
    if (start <= end) {
      // No wrap around zero
      return testAngle >= start && testAngle <= end;
    } else {
      // Wraps around zero  
      return testAngle >= start || testAngle <= end;
    }
  }
}

/**
 * Solves a quadratic equation ax² + bx + c = 0
 * Returns real roots only
 */
export function solveQuadratic(a: number, b: number, c: number, epsilon: number = 1e-10): number[] {
  return mathSolveQuadratic(a, b, c, epsilon);
}

/**
 * Creates a horizontal ray from a point (for point-in-polygon testing)
 */
export function createHorizontalRay(origin: Point2D): { origin: Point2D; direction: Point2D } {
  return {
    origin,
    direction: { x: 1, y: 0 } // Points to the right
  };
}