/**
 * Ray-Tracing Utilities
 *
 * Common utility functions for ray-shape intersection algorithms
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import { EPSILON } from '$lib/geometry/math/constants';
import {
    isNearlyEqual,
    solveQuadratic as mathSolveQuadratic,
    normalizeAngle as mathNormalizeAngle,
} from '$lib/geometry/math/functions';

/**
 * Checks if two floating point numbers are approximately equal
 */
export function approxEqual(
    a: number,
    b: number,
    epsilon: number = EPSILON
): boolean {
    return isNearlyEqual(a, b, epsilon);
}

/**
 * Checks if a value is between two bounds (inclusive)
 */
export function isBetween(
    value: number,
    min: number,
    max: number,
    epsilon: number = EPSILON
): boolean {
    return value >= min - epsilon && value <= max + epsilon;
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
    const testAngle: number = mathNormalizeAngle(angle);
    const start: number = mathNormalizeAngle(startAngle);
    const end: number = mathNormalizeAngle(endAngle);

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
export function solveQuadratic(
    a: number,
    b: number,
    c: number,
    epsilon: number = EPSILON
): number[] {
    return mathSolveQuadratic(a, b, c, epsilon);
}

/**
 * Creates a horizontal ray from a point (for point-in-polygon testing)
 */
export function createHorizontalRay(origin: Point2D): {
    origin: Point2D;
    direction: Point2D;
} {
    return {
        origin,
        direction: { x: 1, y: 0 }, // Points to the right
    };
}
