import { PRECISION_DECIMAL_PLACES } from '$lib/geometry/constants';
import type { Point2D } from '$lib/geometry/point';
import { EPSILON } from './constants';

/**
 * Solves a quadratic equation ax² + bx + c = 0
 * @param a coefficient of x²
 * @param b coefficient of x
 * @param c constant term
 * @param epsilon tolerance for numerical comparisons
 * @returns array of real roots
 */
export function solveQuadratic(
    a: number,
    b: number,
    c: number,
    epsilon: number = EPSILON
): number[] {
    if (Math.abs(a) < epsilon) {
        // Linear equation bx + c = 0
        if (Math.abs(b) < epsilon) {
            return []; // No solution or infinite solutions
        }
        return [-c / b];
    }

    // eslint-disable-next-line no-magic-numbers
    const discriminant = b * b - 4 * a * c;

    if (discriminant < -epsilon) {
        // No real roots
        return [];
    } else if (Math.abs(discriminant) < epsilon) {
        // One repeated root

        return [-b / (2 * a)];
    } else {
        // Two distinct roots
        const sqrtDisc = Math.sqrt(discriminant);

        return [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];
    }
}

/**
 * Calculates the perimeter of a polygon defined by an array of points
 * @param points array of polygon vertices
 * @returns perimeter length
 */
export function calculatePerimeter(points: Point2D[]): number {
    if (points.length < 2) {
        return 0;
    }

    let perimeter: number = 0;
    for (let i = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        const dx: number = points[j].x - points[i].x;
        const dy: number = points[j].y - points[i].y;
        perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
}

/**
 * Calculates the squared distance between two points
 * @param p1 first point
 * @param p2 second point
 * @returns squared distance
 */
export function calculateSquaredDistance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
}

/**
 * Tests if two numbers are approximately equal within a tolerance
 * @param a first number
 * @param b second number
 * @param epsilon tolerance for comparison
 * @returns true if numbers are nearly equal
 */
export function isNearlyEqual(
    a: number,
    b: number,
    epsilon: number = EPSILON
): boolean {
    return Math.abs(a - b) < epsilon;
}

export function normalizeVector(v: Point2D): Point2D {
    const length: number = Math.sqrt(v.x * v.x + v.y * v.y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: v.x / length, y: v.y / length };
}

/**
 * Round number to specified decimal places to avoid floating point errors
 */
export function roundToDecimalPlaces(
    value: number,
    places: number = PRECISION_DECIMAL_PLACES
): number {
    // eslint-disable-next-line no-magic-numbers
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
}

/**
 * Calculate Euclidean distance between two points
 * Consolidated from multiple implementations
 */
export function calculateDistanceBetweenPoints(
    p1: Point2D,
    p2: Point2D
): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Normalize an angle to the range [0, 2π]
 * Consolidated from multiple implementations across the codebase
 */
export function normalizeAngle(angle: number): number {
    angle = angle % (2 * Math.PI);
    if (angle < 0) {
        angle += 2 * Math.PI;
    }
    return angle;
}

/**
 * Snap parameter to 0 or 1 if very close to endpoints
 */
export function snapParameter(t: number): number {
    if (t < EPSILON) return 0;
    if (t > 1 - EPSILON) return 1;
    return t;
}
