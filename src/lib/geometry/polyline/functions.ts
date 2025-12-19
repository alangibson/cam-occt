/**
 * Polyline utility functions
 */

import type { Polyline } from './interfaces';

/**
 * Calculate the length of a polyline (open path)
 * Sums the distances between consecutive points without closing the path
 *
 * @param polyline - The polyline to measure
 * @returns Total length of the polyline
 */
export function calculatePolylineLength(polyline: Polyline): number {
    const points = polyline.points;
    if (points.length < 2) {
        return 0;
    }

    let length = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
}

/**
 * Calculate the perimeter of a polyline (closed path)
 * Includes the closing segment from the last point back to the first point
 *
 * @param polyline - The polyline to measure
 * @returns Total perimeter length
 */
export function calculatePerimeter(polyline: Polyline): number {
    const points = polyline.points;
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
