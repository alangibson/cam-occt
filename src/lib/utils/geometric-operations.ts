/**
 * Geometric Operations using Custom Algorithms
 *
 * This module provides accurate geometric calculations for shape containment
 * and spatial relationships using custom mathematical algorithms.
 */

import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type {
    Shape,
    Point2D,
    Line,
    Circle,
    Polyline,
    Ellipse,
    Spline,
} from '../../lib/types';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '../../lib/types/geometry';
import { sampleNURBS } from '../geometry/nurbs';
import { polylineToPoints } from '$lib/geometry/polyline';
import { generateEllipsePoints } from '$lib/geometry/ellipse/index';
import {
    calculatePolygonArea as calculatePolygonAreaShared,
    calculateDistanceBetweenPoints,
    isPointInPolygon as isPointInPolygonShared,
} from './polygon-geometry-shared';
import { GEOMETRIC_PRECISION_TOLERANCE } from '../constants';
import { ELLIPSE_TESSELLATION_POINTS } from '$lib/geometry/ellipse/index';
import { POLYGON_POINTS_MIN } from '$lib/geometry/constants';

export const LEAD_SEGMENT_COUNT = 8;

/**
 * Checks if one closed chain is completely contained within another closed chain
 * using proper geometric containment (point-in-polygon testing)
 */
export function isChainGeometricallyContained(
    innerChain: Chain,
    outerChain: Chain
): boolean {
    // Extract polygon points from both chains
    const innerPolygon: Point2D[] | null = extractPolygonFromChain(innerChain);
    const outerPolygon: Point2D[] | null = extractPolygonFromChain(outerChain);

    if (
        !innerPolygon ||
        !outerPolygon ||
        innerPolygon.length < POLYGON_POINTS_MIN ||
        outerPolygon.length < POLYGON_POINTS_MIN
    ) {
        throw new Error(
            `Failed to extract polygons for containment check: inner chain ${innerChain.id}=${!!innerPolygon}, outer chain ${outerChain.id}=${!!outerPolygon}. Chains may have gaps preventing polygon creation.`
        );
    }

    // Check if all points of inner polygon are inside outer polygon
    return isPolygonContained(innerPolygon, outerPolygon);
}

/**
 * Extracts a polygon representation from a chain for geometric operations
 */
function extractPolygonFromChain(chain: Chain): Point2D[] | null {
    if (!chain || !chain.shapes || chain.shapes.length === 0) {
        return null;
    }

    const points: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapePoints: Point2D[] = getShapePoints(shape);
        if (shapePoints && shapePoints.length > 0) {
            // Add points, but avoid duplicating the last point of previous shape with first point of next
            if (points.length === 0) {
                points.push(...shapePoints);
            } else {
                // Skip first point if it's close to the last added point
                const lastPoint = points[points.length - 1];
                const firstNewPoint = shapePoints[0];
                const distance = calculateDistanceBetweenPoints(
                    lastPoint,
                    firstNewPoint
                );

                if (distance > GEOMETRIC_PRECISION_TOLERANCE) {
                    points.push(...shapePoints);
                } else {
                    points.push(...shapePoints.slice(1));
                }
            }
        }
    }

    // Remove duplicate points and ensure we have enough for a polygon
    const cleanedPoints: Point2D[] = removeDuplicatePoints(points);
    return cleanedPoints.length >= POLYGON_POINTS_MIN ? cleanedPoints : null;
}

/**
 * Gets representative points from a shape
 */
function getShapePoints(shape: Shape): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            // Create polygon approximation of circle with 32 points
            const points: Point2D[] = [];
            const segments: number = 32;
            for (let i: number = 0; i < segments; i++) {
                const angle: number = (i * 2 * Math.PI) / segments;
                points.push({
                    x: circle.center.x + circle.radius * Math.cos(angle),
                    y: circle.center.y + circle.radius * Math.sin(angle),
                });
            }
            return points;

        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            // Create polygon approximation of arc
            const arcPoints: Point2D[] = [];
            let startAngle: number = arc.startAngle;
            let endAngle: number = arc.endAngle;

            // Normalize angles and handle clockwise arcs
            if (arc.clockwise) {
                [startAngle, endAngle] = [endAngle, startAngle];
            }

            // Calculate arc span
            let span: number = endAngle - startAngle;
            if (span <= 0) span += 2 * Math.PI;

            const arcSegments: number = Math.max(
                LEAD_SEGMENT_COUNT,
                Math.ceil(span / (Math.PI / LEAD_SEGMENT_COUNT))
            ); // At least 8 segments

            for (let i: number = 0; i <= arcSegments; i++) {
                const angle: number = startAngle + (span * i) / arcSegments;
                arcPoints.push({
                    x: arc.center.x + arc.radius * Math.cos(angle),
                    y: arc.center.y + arc.radius * Math.sin(angle),
                });
            }
            return arcPoints;

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            return polylineToPoints(polyline);

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Create polygon approximation of ellipse
            const ellipsePoints: Point2D[] = [];
            const ellipseSegments: number = 64; // More segments for ellipse to capture shape accurately

            // Determine if this is an ellipse arc or full ellipse
            const isArc: boolean =
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number';

            if (isArc) {
                // Ellipse arc - only sample between start and end parameters
                const startParam: number = ellipse.startParam!;
                const endParam: number = ellipse.endParam!;
                let paramSpan: number = endParam - startParam;

                // Handle parameter wrapping
                if (paramSpan <= 0) paramSpan += 2 * Math.PI;

                const numSegments: number = Math.max(
                    LEAD_SEGMENT_COUNT,
                    Math.ceil((ellipseSegments * paramSpan) / (2 * Math.PI))
                );

                const arcPoints = generateEllipsePoints(
                    ellipse,
                    startParam,
                    startParam + paramSpan,
                    numSegments + 1
                );
                ellipsePoints.push(...arcPoints);
            } else {
                // Full ellipse
                const fullEllipsePoints = generateEllipsePoints(
                    ellipse,
                    0,
                    2 * Math.PI,
                    ellipseSegments
                );
                ellipsePoints.push(...fullEllipsePoints);
            }

            return ellipsePoints;

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;
            try {
                // Use NURBS sampling for accurate polygon representation
                return sampleNURBS(spline, ELLIPSE_TESSELLATION_POINTS); // Use more points for geometric accuracy
            } catch {
                // Fallback to fit points or control points if NURBS evaluation fails
                if (spline.fitPoints && spline.fitPoints.length > 0) {
                    return spline.fitPoints;
                } else if (
                    spline.controlPoints &&
                    spline.controlPoints.length > 0
                ) {
                    return spline.controlPoints;
                }
                return [];
            }

        default:
            return [];
    }
}

/**
 * Removes duplicate points from an array
 */
function removeDuplicatePoints(
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
function isPolygonContained(
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
 * Checks if two line segments intersect
 */
function doLineSegmentsIntersect(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D
): boolean {
    const d1: number = direction(p3, p4, p1);
    const d2: number = direction(p3, p4, p2);
    const d3: number = direction(p1, p2, p3);
    const d4: number = direction(p1, p2, p4);

    if (
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    ) {
        return true;
    }

    // Check for collinear points
    if (d1 === 0 && onSegment(p3, p1, p4)) return true;
    if (d2 === 0 && onSegment(p3, p2, p4)) return true;
    if (d3 === 0 && onSegment(p1, p3, p2)) return true;
    if (d4 === 0 && onSegment(p1, p4, p2)) return true;

    return false;
}

/**
 * Calculates the direction of turn from line p1-p2 to point p3
 */
function direction(p1: Point2D, p2: Point2D, p3: Point2D): number {
    return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * Checks if point q lies on line segment pr
 */
function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
    return (
        q.x <= Math.max(p.x, r.x) &&
        q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) &&
        q.y >= Math.min(p.y, r.y)
    );
}

/**
 * Point-in-polygon test using ray casting algorithm
 * Re-exported from polygon-geometry-shared for backward compatibility
 */
export const isPointInPolygon = isPointInPolygonShared;

/**
 * Calculates the area of a polygon using the shoelace formula
 * Delegated to polygon-geometry-shared.ts to eliminate duplication
 */
export function calculatePolygonArea(polygon: Point2D[]): number {
    return calculatePolygonAreaShared(polygon);
}

/**
 * Calculates the centroid of a polygon
 */
export function calculatePolygonCentroid(polygon: Point2D[]): Point2D | null {
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
