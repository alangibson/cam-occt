import { calculateSquaredDistance } from '$lib/geometry/math/functions';
import type { Point2D } from './interfaces';
import { hashObject } from '$lib/geometry/hash/functions';

/**
 * Check if two points are within tolerance (chain is closed)
 */
export function isPointsClosed(
    point1: Point2D,
    point2: Point2D,
    tolerance: number
): boolean {
    const distance: number = Math.sqrt(
        calculateSquaredDistance(point1, point2)
    );
    return distance <= tolerance;
} /**
 * Calculate the midpoint between two points
 * Exported for use in optimize-start-points.ts
 */

export function calculateMidpoint(start: Point2D, end: Point2D): Point2D {
    return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
    };
}

/**
 * Generate a content hash for a Point2D
 * @param point - The point to hash
 * @returns A SHA-256 hash as a hex string
 */
export async function hashPoint2D(point: Point2D): Promise<string> {
    return hashObject(point);
}

/**
 * Translate a single point by the given offsets
 */
// export function translatePoint(
//     point: Point2D,
//     dx: number,
//     dy: number
// ): Point2D {
//     return {
//         x: point.x + dx,
//         y: point.y + dy,
//     };
// }
