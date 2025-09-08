import type { Point2D } from '../types/geometry';

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
    epsilon: number = 1e-10
): number[] {
    if (Math.abs(a) < epsilon) {
        // Linear equation bx + c = 0
        if (Math.abs(b) < epsilon) {
            return []; // No solution or infinite solutions
        }
        return [-c / b];
    }

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
    epsilon: number = 1e-10
): boolean {
    return Math.abs(a - b) < epsilon;
}
