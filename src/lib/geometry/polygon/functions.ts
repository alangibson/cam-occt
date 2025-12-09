/**
 * Shared Polygon and Geometry Utilities
 *
 * This module consolidates common polygon and geometry operations to eliminate code duplication
 * across polygon-utilities.ts, geometry-utils.ts, and geometric-operations.ts
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Polygon } from './interfaces';
import { POLYGON_POINTS_MIN } from '$lib/cam/chain/constants';
import { doLineSegmentsIntersect } from '$lib/geometry/line/functions';
import { calculateDistanceBetweenPoints } from '$lib/geometry/math/functions';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import { DEFAULT_ARRAY_NOT_FOUND_INDEX } from '$lib/geometry/constants';

/**
 * Calculate the area of a polygon using the shoelace formula
 * Consolidated from multiple implementations
 */
export function calculatePolygonArea(polygon: Polygon): number {
    const points = polygon.points;
    if (points.length < POLYGON_POINTS_MIN) return 0;

    let area: number = 0;
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }

    return Math.abs(area) / 2;
}

/**
 * Point-in-polygon test using ray casting algorithm
 * Consolidated from geometric-containment.ts, geometric-operations.ts, and polygon-utilities.ts
 */
export function isPointInPolygon(point: Point2D, polygon: Polygon): boolean {
    const points = polygon.points;
    if (points.length < POLYGON_POINTS_MIN) return false;

    let inside: boolean = false;
    const x: number = point.x;
    const y: number = point.y;

    for (
        let i: number = 0, j: number = points.length - 1;
        i < points.length;
        j = i++
    ) {
        const xi: number = points[i].x;
        const yi: number = points[i].y;
        const xj: number = points[j].x;
        const yj: number = points[j].y;

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * Calculates the bounding box of a polygon
 */
export function calculatePolygonBounds(
    polygon: Polygon
): { min: Point2D; max: Point2D } | null {
    const points = polygon.points;
    if (points.length === 0) return null;

    let minX: number = points[0].x;
    let maxX: number = points[0].x;
    let minY: number = points[0].y;
    let maxY: number = points[0].y;

    for (let i: number = 1; i < points.length; i++) {
        minX = Math.min(minX, points[i].x);
        maxX = Math.max(maxX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxY = Math.max(maxY, points[i].y);
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}

/**
 * Calculates the centroid of a polygon
 */
export function calculatePolygonCentroid2(polygon: Polygon): Point2D | null {
    const points = polygon.points;
    if (points.length < POLYGON_POINTS_MIN) return null;

    const area = calculatePolygonArea(polygon);
    if (area === 0) return null;

    let cx = 0;
    let cy = 0;

    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const factor = points[i].x * points[j].y - points[j].x * points[i].y;
        cx += (points[i].x + points[j].x) * factor;
        cy += (points[i].y + points[j].y) * factor;
    }

    // eslint-disable-next-line no-magic-numbers
    const signedArea = area * (points[0].x < points[1].x ? 1 : -1);
    // eslint-disable-next-line no-magic-numbers
    cx /= 6 * signedArea;
    // eslint-disable-next-line no-magic-numbers
    cy /= 6 * signedArea;

    return { x: cx, y: cy };
}

/**
 * Removes duplicate points from a polygon
 */
export function removeDuplicatePoints(
    polygon: Polygon,
    tolerance?: number
): Polygon {
    const points = polygon.points;
    const effectiveTolerance =
        tolerance ?? getDefaults().geometry.precisionTolerance;
    if (points.length <= 1) return polygon;

    const result: Point2D[] = [points[0]];

    for (let i: number = 1; i < points.length; i++) {
        const current: Point2D = points[i];
        const last: Point2D = result[result.length - 1];

        const distance = calculateDistanceBetweenPoints(current, last);

        if (distance > effectiveTolerance) {
            result.push(current);
        }
    }

    return { points: result };
}

/**
 * Checks if one polygon is completely contained within another
 */
export function isPolygonContained(
    innerPolygon: Polygon,
    outerPolygon: Polygon
): boolean {
    // Check if all points of inner polygon are inside outer polygon
    for (const point of innerPolygon.points) {
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
function doPolygonsIntersect(poly1: Polygon, poly2: Polygon): boolean {
    const points1 = poly1.points;
    const points2 = poly2.points;

    // Check each edge of poly1 against each edge of poly2
    for (let i: number = 0; i < points1.length; i++) {
        const p1: Point2D = points1[i];
        const p2: Point2D = points1[(i + 1) % points1.length];

        for (let j: number = 0; j < points2.length; j++) {
            const p3: Point2D = points2[j];
            const p4: Point2D = points2[(j + 1) % points2.length];

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
export function calculateSignedArea(polygon: Polygon): number {
    const points = polygon.points;
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

/**
 * Detect containment relationships between multiple polygons
 * Returns a map of polygon indices to their containing polygon index
 * @param polygons Array of polygon vertex arrays
 * @param tolerance Distance tolerance for closure detection
 * @returns Map of containment relationships (contained polygon index -> containing polygon index)
 */
export function detectPolygonContainment(
    polygons: Point2D[][]
): Map<number, number> {
    const containmentMap = new Map<number, number>();

    // Calculate areas for all polygons
    const polygonsWithArea = polygons
        .map((polygon, index) => ({
            polygon,
            index,
            area: calculatePolygonArea({ points: polygon }),
        }))
        .sort((a, b) => b.area - a.area); // Sort by area (largest first)

    // For each polygon, find its smallest containing parent
    for (let i = 1; i < polygonsWithArea.length; i++) {
        const current = polygonsWithArea[i];
        let bestParentIndex = DEFAULT_ARRAY_NOT_FOUND_INDEX;
        let smallestArea = Infinity;

        // Only check larger polygons as potential parents
        for (let j = 0; j < i; j++) {
            const potential = polygonsWithArea[j];

            // Skip if potential parent has same or smaller area
            if (potential.area <= current.area) continue;

            // Check if all points of current polygon are inside potential parent
            let allPointsInside = true;
            for (const point of current.polygon) {
                if (!isPointInPolygon(point, { points: potential.polygon })) {
                    allPointsInside = false;
                    break;
                }
            }

            if (allPointsInside) {
                if (potential.area < smallestArea) {
                    smallestArea = potential.area;
                    bestParentIndex = potential.index;
                }
            }
        }

        // If we found a parent, record the relationship
        if (bestParentIndex >= 0) {
            containmentMap.set(current.index, bestParentIndex);
        }
    }

    return containmentMap;
}
