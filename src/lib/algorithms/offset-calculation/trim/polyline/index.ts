import { EPSILON } from '$lib/geometry/math/constants';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import {
    createPolylineFromVertices,
    polylineToPoints,
    polylineToVertices,
} from '$lib/geometry/polyline/functions';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { generateId } from '$lib/domain/id';
import {
    type KeepSide,
    type TrimResult,
} from '$lib/algorithms/offset-calculation/trim/types';
import { calculateLineParameter } from '$lib/algorithms/offset-calculation/shared/trim-extend-utils';
import {
    DEFAULT_ARRAY_NOT_FOUND_INDEX,
    TOLERANCE_RELAXATION_MULTIPLIER,
} from '$lib/geometry/constants';
import type {
    Polyline,
    PolylineVertex,
} from '$lib/geometry/polyline/interfaces';
import { MIN_VERTICES_FOR_POLYLINE } from '$lib/geometry/polyline/constants';

/**
 * Create a line segment from polyline points at given index
 * Returns null if index is out of bounds
 */
function createSegmentAtIndex(points: Point2D[], index: number): Line | null {
    if (index < 0 || index >= points.length - 1) {
        return null;
    }

    return {
        start: points[index],
        end: points[index + 1],
    };
}

/**
 * Find the closest point on a polyline segment and return distance information
 */
function findClosestPointOnPolylineSegments(
    point: Point2D,
    points: Point2D[]
): {
    minDistance: number;
    closestIndex: number;
    closestParam: number;
} {
    let minDistance: number = Infinity;
    let closestIndex: number = DEFAULT_ARRAY_NOT_FOUND_INDEX;
    let closestParam: number = 0;

    for (let i: number = 0; i < points.length - 1; i++) {
        const segment: Line | null = createSegmentAtIndex(points, i);
        if (!segment) continue;

        const param: number = calculateLineParameter(point, segment);
        const clampedParam: number = Math.max(0, Math.min(1, param));

        // Calculate point on segment at clamped parameter
        const pointOnSegment: Point2D = {
            x:
                segment.start.x +
                clampedParam * (segment.end.x - segment.start.x),
            y:
                segment.start.y +
                clampedParam * (segment.end.y - segment.start.y),
        };

        // Calculate distance to this point

        const distance: number = Math.sqrt(
            Math.pow(point.x - pointOnSegment.x, 2) +
                Math.pow(point.y - pointOnSegment.y, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
            closestParam = clampedParam;
        }
    }

    return { minDistance, closestIndex, closestParam };
}

/**
 * Trim a polyline at a specific point
 */
export function trimPolyline(
    shape: Shape,
    point: Point2D,
    keepSide: KeepSide,
    tolerance: number
): TrimResult {
    const polyline: Polyline = shape.geometry as Polyline;
    const result: TrimResult = {
        success: false,
        shape: null,
        warnings: [],
        errors: [],
    };

    const points: Point2D[] = polylineToPoints(polyline);
    if (points.length < MIN_VERTICES_FOR_POLYLINE) {
        result.errors.push('Cannot trim polyline with less than 2 points');
        return result;
    }

    // Find which segment the intersection point lies on
    let segmentIndex: number = DEFAULT_ARRAY_NOT_FOUND_INDEX;
    let segmentParam: number = 0;

    for (let i: number = 0; i < points.length - 1; i++) {
        const segment: Line | null = createSegmentAtIndex(points, i);
        if (!segment) continue;

        const param: number = calculateLineParameter(point, segment);

        // Check if point is on this segment (with tolerance)
        if (param >= -tolerance && param <= 1 + tolerance) {
            // Also check perpendicular distance
            const segmentVec: Point2D = {
                x: segment.end.x - segment.start.x,
                y: segment.end.y - segment.start.y,
            };
            const pointVec: Point2D = {
                x: point.x - segment.start.x,
                y: point.y - segment.start.y,
            };
            const segmentLength: number = Math.sqrt(
                segmentVec.x * segmentVec.x + segmentVec.y * segmentVec.y
            );

            if (segmentLength < EPSILON) continue; // Skip degenerate segments

            const perpDistance: number =
                Math.abs(
                    segmentVec.x * pointVec.y - segmentVec.y * pointVec.x
                ) / segmentLength;

            if (perpDistance <= tolerance) {
                segmentIndex = i;
                segmentParam = Math.max(0, Math.min(1, param)); // Clamp to valid range
                break;
            }
        }
    }

    if (segmentIndex === DEFAULT_ARRAY_NOT_FOUND_INDEX) {
        // Fallback: find the closest segment if exact match fails
        const { minDistance, closestIndex, closestParam } =
            findClosestPointOnPolylineSegments(point, points);

        // Use relaxed tolerance (10x normal tolerance for polylines)
        const relaxedTolerance: number =
            tolerance * TOLERANCE_RELAXATION_MULTIPLIER;
        if (
            closestIndex !== DEFAULT_ARRAY_NOT_FOUND_INDEX &&
            minDistance <= relaxedTolerance
        ) {
            segmentIndex = closestIndex;
            segmentParam = closestParam;
            result.warnings.push(
                'Polyline trim point found via relaxed closest segment matching'
            );
        } else {
            result.errors.push('Trim point is not on any polyline segment');
            return result;
        }
    }

    // Create new point array based on keepSide
    let newPoints: Point2D[] = [];

    switch (keepSide) {
        case 'start':
        case 'before':
            // Keep all points up to and including the segment start point
            newPoints = points.slice(0, segmentIndex + 1);

            // If intersection is not at the segment start point, add the intersection point
            if (segmentParam > EPSILON) {
                newPoints.push({ ...point });
            } else {
                // Intersection is at segment start, just update that point
                newPoints[newPoints.length - 1] = { ...point };
            }
            break;

        case 'end':
        case 'after':
            // Start with intersection point
            newPoints = [{ ...point }];

            // If intersection is not at the segment end point, include points from segment end onwards
            if (segmentParam < 1 - EPSILON) {
                newPoints.push(...points.slice(segmentIndex + 1));
            } else {
                // Intersection is at segment end, include points from next segment onwards
                newPoints.push(...points.slice(segmentIndex + 2));
            }
            break;

        default:
            result.errors.push(
                `Invalid keepSide value for polyline trimming: ${keepSide}`
            );
            return result;
    }

    // Ensure we have at least 2 points
    if (newPoints.length < MIN_VERTICES_FOR_POLYLINE) {
        result.errors.push('Trimmed polyline would have less than 2 points');
        return result;
    }

    // Handle vertices array if it exists (for bulge support)
    let newVertices: PolylineVertex[] = [];
    const originalVertices: PolylineVertex[] = polylineToVertices(polyline);
    if (originalVertices.length > 0) {
        switch (keepSide) {
            case 'start':
            case 'before':
                newVertices = originalVertices.slice(0, segmentIndex + 1);
                // Update the last vertex to the intersection point
                newVertices[newVertices.length - 1] = {
                    x: point.x,
                    y: point.y,
                    bulge: 0, // Reset bulge at intersection
                };
                break;

            case 'end':
            case 'after':
                newVertices = [
                    { x: point.x, y: point.y, bulge: 0 }, // Intersection point with no bulge
                    ...originalVertices.slice(segmentIndex + 1),
                ];
                break;
        }
    }

    // Create the trimmed polyline using the constructor
    const trimmedShape: Shape = createPolylineFromVertices(newPoints, false);
    const trimmedPolyline: Polyline = trimmedShape.geometry as Polyline;

    result.shape = {
        ...shape,
        id: generateId(),
        geometry: trimmedPolyline,
    };
    result.success = true;

    return result;
}
