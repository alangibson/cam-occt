/**
 * Shared Polygon and Geometry Utilities
 *
 * This module consolidates common polygon and geometry operations to eliminate code duplication
 * across polygon-utilities.ts, geometry-utils.ts, and geometric-operations.ts
 */

import type { Point2D } from '$lib/types/geometry';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain';

/**
 * Calculate the area of a polygon using the shoelace formula
 * Consolidated from multiple implementations
 */
export function calculatePolygonArea(polygon: Point2D[]): number {
    if (polygon.length < POLYGON_POINTS_MIN) return 0;

    let area: number = 0;
    for (let i: number = 0; i < polygon.length; i++) {
        const j: number = (i + 1) % polygon.length;
        area += polygon[i].x * polygon[j].y;
        area -= polygon[j].x * polygon[i].y;
    }

    return Math.abs(area) / 2;
}

/**
 * Point-in-polygon test using ray casting algorithm
 * Consolidated from geometric-containment.ts, geometric-operations.ts, and polygon-utilities.ts
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    if (polygon.length < POLYGON_POINTS_MIN) return false;

    let inside: boolean = false;
    const x: number = point.x;
    const y: number = point.y;

    for (
        let i: number = 0, j: number = polygon.length - 1;
        i < polygon.length;
        j = i++
    ) {
        const xi: number = polygon[i].x;
        const yi: number = polygon[i].y;
        const xj: number = polygon[j].x;
        const yj: number = polygon[j].y;

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }

    return inside;
}
