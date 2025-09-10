/**
 * Shape Bounding Box Utilities
 *
 * Consolidates bounding box calculation functions that were duplicated across:
 * - geometric-containment-jsts.ts
 * - part-detection.ts
 */

import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type {
    Point2D,
    Shape,
    Line,
    Polyline,
    Ellipse,
    Spline,
    Circle,
} from '../types';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '../types/geometry';
import { polylineToPoints } from '$lib/geometry/polyline';
import { sampleNURBS } from '../geometry/nurbs';
import { HIGH_TESSELLATION_SEGMENTS } from '../geometry/constants';
import { STANDARD_TESSELLATION_COUNT } from '$lib/constants';
import { getBoundingBoxForArc } from '../geometry/bounding-box';

export interface BoundingBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Calculates the bounding box of a chain by aggregating bounds of all shapes
 */
export function calculateChainBoundingBox(chain: Chain): BoundingBox {
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;

    for (const shape of chain.shapes) {
        const shapeBounds = getShapeBoundingBox(shape);
        minX = Math.min(minX, shapeBounds.minX);
        maxX = Math.max(maxX, shapeBounds.maxX);
        minY = Math.min(minY, shapeBounds.minY);
        maxY = Math.max(maxY, shapeBounds.maxY);
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Gets the bounding box of a single shape
 */
export function getShapeBoundingBox(shape: Shape): BoundingBox {
    switch (shape.type) {
        case GeometryType.LINE:
            const line = shape.geometry as Line;
            return {
                minX: Math.min(line.start.x, line.end.x),
                maxX: Math.max(line.start.x, line.end.x),
                minY: Math.min(line.start.y, line.end.y),
                maxY: Math.max(line.start.y, line.end.y),
            };

        case GeometryType.CIRCLE:
            const circle = shape.geometry as Circle;
            return {
                minX: circle.center.x - circle.radius,
                maxX: circle.center.x + circle.radius,
                minY: circle.center.y - circle.radius,
                maxY: circle.center.y + circle.radius,
            };

        case GeometryType.ARC:
            const arc = shape.geometry as Arc;
            // Use actual arc bounds instead of conservative circle bounds
            const arcBounds = getBoundingBoxForArc(arc);
            return {
                minX: arcBounds.min.x,
                maxX: arcBounds.max.x,
                minY: arcBounds.min.y,
                maxY: arcBounds.max.y,
            };

        case GeometryType.POLYLINE:
            return calculatePolylineBoundingBox(shape.geometry as Polyline);

        case GeometryType.SPLINE:
            return calculateSplineBoundingBox(shape.geometry as Spline);

        default:
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
}

/**
 * Calculates the bounding box of a spline using NURBS sampling
 */
export function calculateSplineBoundingBox(spline: Spline): BoundingBox {
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;

    // Try to use NURBS sampling for accurate bounds
    let points: Point2D[];
    try {
        points = sampleNURBS(spline, HIGH_TESSELLATION_SEGMENTS); // Sample enough points for good bounds
    } catch {
        // Fallback to fit points or control points
        points = spline.fitPoints || spline.controlPoints || [];
    }

    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    // If no points found, return zero bounding box
    if (points.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Calculates the bounding box of a polyline
 */
export function calculatePolylineBoundingBox(polyline: Polyline): BoundingBox {
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;

    // If polyline has segments (new format), process each segment for accurate bounds
    if (polyline.shapes && polyline.shapes.length > 0) {
        for (const shape of polyline.shapes) {
            const segmentBounds = getShapeBoundingBox(shape);
            minX = Math.min(minX, segmentBounds.minX);
            maxX = Math.max(maxX, segmentBounds.maxX);
            minY = Math.min(minY, segmentBounds.minY);
            maxY = Math.max(maxY, segmentBounds.maxY);
        }
    } else {
        // Fallback for old format or legacy polylines - use points
        for (const point of polylineToPoints(polyline)) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Get all significant points from a shape for bounding box calculation
 * Consolidated from translate-to-positive.ts and dxf-parser.ts
 */
export function getShapePointsForBounds(shape: Shape): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            return [
                {
                    x: circle.center.x - circle.radius,
                    y: circle.center.y - circle.radius,
                },
                {
                    x: circle.center.x + circle.radius,
                    y: circle.center.y + circle.radius,
                },
            ];

        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            // Use actual arc bounds instead of full circle bounds
            const arcBounds = getBoundingBoxForArc(arc);
            return [arcBounds.min, arcBounds.max];

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            // If polyline has segments (new format), get bounds from all segments
            if (polyline.shapes && polyline.shapes.length > 0) {
                const allPoints: Point2D[] = [];
                for (const segmentShape of polyline.shapes) {
                    allPoints.push(...getShapePointsForBounds(segmentShape));
                }
                return allPoints;
            } else {
                // Fallback for old format - use points
                return polylineToPoints(polyline);
            }

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Calculate bounding box points for ellipse
            const majorAxisLength: number = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            const minorAxisLength: number =
                majorAxisLength * ellipse.minorToMajorRatio;

            // For bounding box calculation, we need the extent of the ellipse
            // This is an approximation - true ellipse bounds calculation is more complex
            const maxExtent: number = Math.max(
                majorAxisLength,
                minorAxisLength
            );

            return [
                {
                    x: ellipse.center.x - maxExtent,
                    y: ellipse.center.y - maxExtent,
                },
                {
                    x: ellipse.center.x + maxExtent,
                    y: ellipse.center.y + maxExtent,
                },
            ];

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;
            try {
                // Sample points along the NURBS curve for accurate bounds
                return sampleNURBS(spline, STANDARD_TESSELLATION_COUNT); // Use fewer points for bounds calculation
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
