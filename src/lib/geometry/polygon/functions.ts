/**
 * Shared Polygon and Geometry Utilities
 *
 * This module consolidates common polygon and geometry operations to eliminate code duplication
 * across polygon-utilities.ts, geometry-utils.ts, and geometric-operations.ts
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain/constants';
import { doLineSegmentsIntersect } from '$lib/geometry/line/functions';
import { GEOMETRIC_PRECISION_TOLERANCE } from '$lib/geometry/math/constants';
import { calculateDistanceBetweenPoints } from '$lib/geometry/math/functions';

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
} /**
 * Calculates the bounding box of a polygon
 */

export function calculatePolygonBounds(
    polygon: Point2D[]
): { min: Point2D; max: Point2D } | null {
    if (polygon.length === 0) return null;

    let minX: number = polygon[0].x;
    let maxX: number = polygon[0].x;
    let minY: number = polygon[0].y;
    let maxY: number = polygon[0].y;

    for (let i: number = 1; i < polygon.length; i++) {
        minX = Math.min(minX, polygon[i].x);
        maxX = Math.max(maxX, polygon[i].x);
        minY = Math.min(minY, polygon[i].y);
        maxY = Math.max(maxY, polygon[i].y);
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}
/**
 * Calculates the centroid of a polygon
 */

export function calculatePolygonCentroid2(polygon: Point2D[]): Point2D | null {
    if (polygon.length < POLYGON_POINTS_MIN) return null;

    const area = calculatePolygonArea(polygon);
    if (area === 0) return null;

    let cx = 0;
    let cy = 0;

    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        const factor =
            polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
        cx += (polygon[i].x + polygon[j].x) * factor;
        cy += (polygon[i].y + polygon[j].y) * factor;
    }

    // eslint-disable-next-line no-magic-numbers
    const signedArea = area * (polygon[0].x < polygon[1].x ? 1 : -1);
    // eslint-disable-next-line no-magic-numbers
    cx /= 6 * signedArea;
    // eslint-disable-next-line no-magic-numbers
    cy /= 6 * signedArea;

    return { x: cx, y: cy };
}
/**
 * Removes duplicate points from an array
 */

export function removeDuplicatePoints(
    points: Point2D[],
    tolerance: number = GEOMETRIC_PRECISION_TOLERANCE
): Point2D[] {
    if (points.length <= 1) return points;

    const result: Point2D[] = [points[0]];

    for (let i: number = 1; i < points.length; i++) {
        const current: Point2D = points[i];
        const last: Point2D = result[result.length - 1];

        const distance = calculateDistanceBetweenPoints(current, last);

        if (distance > tolerance) {
            result.push(current);
        }
    }

    return result;
}
/**
 * Checks if one polygon is completely contained within another
 */

export function isPolygonContained(
    innerPolygon: Point2D[],
    outerPolygon: Point2D[]
): boolean {
    // Check if all points of inner polygon are inside outer polygon
    for (const point of innerPolygon) {
        if (!isPointInPolygon(point, outerPolygon)) {
            return false;
        }
    }

    // Additional check: ensure polygons don't intersect at edges
    // If inner is truly contained, no edges should intersect
    return !doPolygonsIntersect(innerPolygon, outerPolygon);
}
/**
 * Checks if two polygons intersect at their edges
 */
function doPolygonsIntersect(poly1: Point2D[], poly2: Point2D[]): boolean {
    // Check each edge of poly1 against each edge of poly2
    for (let i: number = 0; i < poly1.length; i++) {
        const p1: Point2D = poly1[i];
        const p2: Point2D = poly1[(i + 1) % poly1.length];

        for (let j: number = 0; j < poly2.length; j++) {
            const p3: Point2D = poly2[j];
            const p4: Point2D = poly2[(j + 1) % poly2.length];

            if (doLineSegmentsIntersect(p1, p2, p3, p4)) {
                return true;
            }
        }
    }

    return false;
}
/**
 * Calculate signed area using the shoelace formula
 * Positive area indicates counterclockwise orientation
 * Negative area indicates clockwise orientation
 */
export function calculateSignedArea(points: Point2D[]): number {
    if (points.length < POLYGON_POINTS_MIN) return 0;

    let area: number = 0;
    const n: number = points.length;

    for (let i: number = 0; i < n; i++) {
        const j: number = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }

    return area / 2;
}
