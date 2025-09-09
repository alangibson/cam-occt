import type { Point2D, Line } from '../../lib/types/geometry';
import { calculatePerimeter } from './math-utils';
import { calculatePolygonArea as calculatePolygonAreaShared } from './polygon-geometry-shared';
import { EPSILON } from '../constants';
import { POLYGON_POINTS_MIN } from '$lib/geometry/constants';

export enum WindingDirection {
    CW = 'CW',
    CCW = 'CCW',
    degenerate = 'degenerate',
}

/**
 * Calculate normalized direction vector and length of a line
 * @param line Line to process
 * @returns Object with direction vector, unit vector, and length, or null if degenerate
 */
export function calculateLineDirectionAndLength(line: Line): {
    direction: Point2D;
    unitDirection: Point2D;
    length: number;
} | null {
    const direction: Point2D = {
        x: line.end.x - line.start.x,
        y: line.end.y - line.start.y,
    };

    const length: number = Math.sqrt(
        direction.x * direction.x + direction.y * direction.y
    );

    if (length < EPSILON) {
        return null; // Degenerate line
    }

    const unitDirection: Point2D = {
        x: direction.x / length,
        y: direction.y / length,
    };

    return { direction, unitDirection, length };
}

/**
 * Calculate the signed area of a polygon using the shoelace formula
 *
 * The signed area indicates the winding direction:
 * - Positive area: Clockwise (CW) winding
 * - Negative area: Counter-clockwise (CCW) winding
 * - Zero area: Degenerate polygon (collinear points or self-intersecting)
 *
 * @param points Array of polygon vertices in order
 * @returns Signed area of the polygon (positive for CW, negative for CCW)
 */
export function calculateSignedArea(points: Point2D[]): number {
    if (points.length < POLYGON_POINTS_MIN) {
        return 0; // Need at least 3 points to form a polygon
    }

    let area: number = 0;
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        area += (points[j].x - points[i].x) * (points[j].y + points[i].y);
    }
    return area / 2;
}

/**
 * Calculate the unsigned (absolute) area of a polygon
 * Delegated to polygon-geometry-shared.ts to eliminate duplication
 *
 * @param points Array of polygon vertices in order
 * @returns Absolute area of the polygon (always positive)
 */
export function calculatePolygonArea(points: Point2D[]): number {
    return calculatePolygonAreaShared(points);
}

/**
 * Determine the winding direction of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns 'CW' for clockwise, 'CCW' for counter-clockwise, 'degenerate' for zero area
 */
export function getWindingDirection(points: Point2D[]): WindingDirection {
    const signedArea: number = calculateSignedArea(points);

    if (Math.abs(signedArea) < Number.EPSILON) {
        return WindingDirection.degenerate;
    }

    return signedArea > 0 ? WindingDirection.CW : WindingDirection.CCW;
}

/**
 * Check if a polygon is wound clockwise
 *
 * @param points Array of polygon vertices in order
 * @returns True if clockwise, false if counter-clockwise or degenerate
 */
export function isClockwise(points: Point2D[]): boolean {
    return calculateSignedArea(points) > 0;
}

/**
 * Check if a polygon is wound counter-clockwise
 *
 * @param points Array of polygon vertices in order
 * @returns True if counter-clockwise, false if clockwise or degenerate
 */
export function isCounterClockwise(points: Point2D[]): boolean {
    return calculateSignedArea(points) < 0;
}

/**
 * Reverse the winding direction of a polygon by reversing the point order
 *
 * @param points Array of polygon vertices
 * @returns New array with reversed point order
 */
export function reverseWinding(points: Point2D[]): Point2D[] {
    return [...points].reverse();
}

/**
 * Ensure a polygon has clockwise winding direction
 *
 * @param points Array of polygon vertices
 * @returns Array with clockwise winding (reversed if originally CCW)
 */
export function ensureClockwise(points: Point2D[]): Point2D[] {
    return isClockwise(points) ? points : reverseWinding(points);
}

/**
 * Ensure a polygon has counter-clockwise winding direction
 *
 * @param points Array of polygon vertices
 * @returns Array with counter-clockwise winding (reversed if originally CW)
 */
export function ensureCounterClockwise(points: Point2D[]): Point2D[] {
    return isCounterClockwise(points) ? points : reverseWinding(points);
}

/**
 * Calculate the centroid (geometric center) of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns Point representing the centroid
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
    if (points.length === 0) {
        return { x: 0, y: 0 };
    }

    const area: number = calculateSignedArea(points);
    if (Math.abs(area) < Number.EPSILON) {
        // Degenerate polygon - return arithmetic mean of points
        const sum: Point2D = points.reduce(
            (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
            {
                x: 0,
                y: 0,
            }
        );
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    let cx: number = 0,
        cy: number = 0;
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        const cross: number =
            points[i].x * points[j].y - points[j].x * points[i].y;
        cx += (points[i].x + points[j].x) * cross;
        cy += (points[i].y + points[j].y) * cross;
    }

    // The formula works correctly with signed area - don't use absolute value
    // If the polygon is CW (positive area), the centroid calculation is direct
    // If the polygon is CCW (negative area), both area and cross products are negative, so they cancel out
    // eslint-disable-next-line no-magic-numbers
    const factor: number = 1 / (6 * area);
    return { x: cx * factor, y: cy * factor };
}

/**
 * Check if a polygon is simple (non-self-intersecting)
 *
 * This is a basic check - it doesn't detect all self-intersections but catches
 * the most common cases like immediately adjacent segments intersecting.
 *
 * @param points Array of polygon vertices in order
 * @returns True if the polygon appears to be simple
 */
export function isSimplePolygon(points: Point2D[]): boolean {
    if (points.length < POLYGON_POINTS_MIN) {
        return false;
    }

    // Check for duplicate consecutive points
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        const dx: number = points[j].x - points[i].x;
        const dy: number = points[j].y - points[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < Number.EPSILON) {
            return false; // Duplicate points
        }
    }

    return true; // Basic validation passed
}

/**
 * Calculate the perimeter of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns Total perimeter length
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
    return calculatePerimeter(points);
}
